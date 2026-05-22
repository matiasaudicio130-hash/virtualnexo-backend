"""
Servicio de pagos con Stripe.

MODO SIMULACIÓN (STRIPE_SECRET_KEY vacío):
  - create_checkout_session devuelve una sesión ficticia
  - simulate_success registra el pago directamente en la DB
  - Útil para dev sin cuenta de Stripe

MODO REAL (STRIPE_SECRET_KEY configurado):
  - create_checkout_session crea una Checkout Session en Stripe
  - El usuario es redirigido a la página de pago de Stripe
  - Stripe llama al webhook /stripe/webhook al completar
  - El webhook registra el pago y activa la membresía

Para activar el modo real, agregar en backend/.env:
  STRIPE_SECRET_KEY=sk_test_... (o sk_live_...)
  STRIPE_PUBLISHABLE_KEY=pk_test_... (o pk_live_...)
  STRIPE_WEBHOOK_SECRET=whsec_...
"""
import logging
import uuid
from typing import Optional

from app.core.config import get_settings
from app.core.branding import APP_NAME
from app.db.supabase import get_supabase
from app.services.payment_service import payment_service
from app.services.exchange_service import exchange_service

logger = logging.getLogger(__name__)
settings = get_settings()


class StripeService:

    @property
    def simulation_mode(self) -> bool:
        return not bool(settings.STRIPE_SECRET_KEY)

    def _stripe(self):
        """Devuelve el cliente de Stripe. Solo llamar en modo real."""
        import stripe as stripe_lib
        stripe_lib.api_key = settings.STRIPE_SECRET_KEY
        return stripe_lib

    # ------------------------------------------------------------------
    # Customer management
    # ------------------------------------------------------------------

    def get_or_create_customer(self, user_id: str, email: str, name: str) -> Optional[str]:
        """Devuelve el stripe_customer_id existente o crea uno nuevo."""
        db = get_supabase()
        existing = db.table("stripe_customers").select("stripe_customer_id").eq("user_id", user_id).execute()
        if existing.data:
            return existing.data[0]["stripe_customer_id"]

        if self.simulation_mode:
            fake_id = f"cus_sim_{user_id[:8]}"
            db.table("stripe_customers").insert({"user_id": user_id, "stripe_customer_id": fake_id}).execute()
            return fake_id

        stripe = self._stripe()
        customer = stripe.Customer.create(email=email, name=name, metadata={"user_id": user_id})
        db.table("stripe_customers").insert({"user_id": user_id, "stripe_customer_id": customer.id}).execute()
        return customer.id

    # ------------------------------------------------------------------
    # Checkout Session
    # ------------------------------------------------------------------

    async def create_checkout_session(
        self,
        user_id: str,
        email: str,
        name: str,
        plan: str,
        currency: str,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        """
        Crea una Checkout Session.
        En modo simulación devuelve una URL ficticia.
        En modo real devuelve la URL de Stripe.
        """
        db = get_supabase()

        # Obtener precio del plan
        price_settings = payment_service._get_price_settings()
        rate = await exchange_service.get_current_rate()

        if currency == "ARS":
            amount_ars = price_settings.get(f"price_{plan}_ars", 0)
            amount_usd = round(amount_ars / rate["sell"], 2) if rate["sell"] else 0
        else:
            amount_usd = price_settings.get(f"price_{plan}_usd", 0)
            amount_ars = round(amount_usd * rate["sell"], 2)

        if self.simulation_mode:
            session_id = f"cs_sim_{uuid.uuid4().hex[:16]}"
            db.table("stripe_sessions").insert({
                "user_id": user_id,
                "stripe_session_id": session_id,
                "plan": plan,
                "currency": currency,
                "amount_ars": amount_ars,
                "amount_usd": amount_usd,
                "status": "pending",
            }).execute()
            return {
                "session_id": session_id,
                "url": None,
                "simulation": True,
                "amount_ars": amount_ars,
                "amount_usd": amount_usd,
                "plan": plan,
                "currency": currency,
            }

        # Modo real
        stripe = self._stripe()
        customer_id = self.get_or_create_customer(user_id, email, name)

        # Stripe trabaja con centavos de la moneda
        # Para Argentina cobramos en ARS
        if currency == "ARS":
            stripe_currency = "ars"
            stripe_amount = int(amount_ars * 100)
        else:
            stripe_currency = "usd"
            stripe_amount = int(amount_usd * 100)

        plan_labels = {"monthly": "Mensual", "annual": "Anual", "lifetime": "Vitalicio"}
        session = stripe.checkout.Session.create(
            customer=customer_id or "",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": stripe_currency,
                    "product_data": {
                        "name": f"{APP_NAME} - Plan {plan_labels.get(plan, plan)}",
                        "description": f"Membresia {plan_labels.get(plan, plan).lower()} a {APP_NAME}",
                    },
                    "unit_amount": stripe_amount,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "plan": plan,
                "currency": currency,
                "amount_ars": str(amount_ars),
                "amount_usd": str(amount_usd),
            },
        )

        db.table("stripe_sessions").insert({
            "user_id": user_id,
            "stripe_session_id": session.id,
            "plan": plan,
            "currency": currency,
            "amount_ars": amount_ars,
            "amount_usd": amount_usd,
            "status": "pending",
        }).execute()

        return {
            "session_id": session.id,
            "url": session.url,
            "simulation": False,
            "amount_ars": amount_ars,
            "amount_usd": amount_usd,
            "plan": plan,
            "currency": currency,
        }

    # ------------------------------------------------------------------
    # Webhook (modo real)
    # ------------------------------------------------------------------

    async def handle_webhook(self, payload: bytes, sig_header: str) -> dict:
        """Procesa eventos de Stripe. Solo en modo real."""
        stripe = self._stripe()
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            logger.error(f"Stripe webhook error: {e}")
            raise

        if event["type"] == "checkout.session.completed":
            await self._handle_checkout_completed(event["data"]["object"])

        return {"received": True}

    async def _handle_checkout_completed(self, session) -> None:
        meta = session.get("metadata", {})
        user_id  = meta.get("user_id")
        plan     = meta.get("plan", "monthly")
        currency = meta.get("currency", "ARS")

        if not user_id:
            logger.error("Webhook: session sin user_id en metadata")
            return

        db = get_supabase()

        # Idempotencia: si ya está completada, no procesar de nuevo
        existing = db.table("stripe_sessions").select("status").eq(
            "stripe_session_id", session["id"]
        ).execute()
        if existing.data and existing.data[0]["status"] == "completed":
            logger.info(f"Stripe webhook duplicado ignorado: {session['id']}")
            return

        db.table("stripe_sessions").update({"status": "completed"}).eq(
            "stripe_session_id", session["id"]
        ).execute()

        await payment_service.register_payment(
            user_id=user_id,
            plan=plan,
            currency=currency,
            method="stripe",
            external_id=session["id"],
            status="completed",
        )
        logger.info(f"Stripe pago completado: user={user_id} plan={plan}")

    # ------------------------------------------------------------------
    # Simulación de éxito (solo dev)
    # ------------------------------------------------------------------

    async def simulate_success(self, session_id: str) -> dict:
        """Simula que Stripe confirmó el pago. Solo en modo simulación."""
        if not self.simulation_mode:
            raise ValueError("simulate_success solo está disponible en modo simulación")

        db = get_supabase()
        sess_r = db.table("stripe_sessions").select("*").eq(
            "stripe_session_id", session_id
        ).execute()
        if not sess_r.data:
            raise ValueError(f"Session {session_id} no encontrada")
        sess = sess_r.data[0]

        db.table("stripe_sessions").update({"status": "completed"}).eq(
            "stripe_session_id", session_id
        ).execute()

        payment = await payment_service.register_payment(
            user_id=sess["user_id"],
            plan=sess["plan"],
            currency=sess["currency"],
            method="stripe",
            external_id=session_id,
            status="completed",
        )
        return {"simulated": True, "payment": payment}


stripe_service = StripeService()
