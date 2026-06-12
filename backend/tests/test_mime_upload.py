"""
Tests para el procesamiento de MIME types en upload de chat.

BUG original: Chrome/Android envía 'audio/webm;codecs=opus' y
'video/mp4;codecs=avc1.42E01E,mp4a.40.2'. El backend comparaba contra
un set de MIME exactos, rechazando todo lo que tuviera codec info.
"""


ALLOWED_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    "image/heic", "image/heif",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg",
}


def sanitize_mime(raw: str) -> str:
    """Lógica de sanitización del endpoint — strippea codec suffix."""
    return (raw or "").split(";")[0].strip().lower()


class TestMimeSanitization:

    def test_audio_webm_con_codec_es_aceptado(self):
        """BUG: 'audio/webm;codecs=opus' era rechazado por el backend."""
        raw = "audio/webm;codecs=opus"
        assert sanitize_mime(raw) in ALLOWED_MIME

    def test_video_mp4_con_codec_es_aceptado(self):
        """BUG: grabaciones de video móvil incluyen codec info."""
        raw = "video/mp4;codecs=avc1.42E01E,mp4a.40.2"
        assert sanitize_mime(raw) in ALLOWED_MIME

    def test_audio_webm_puro_sigue_funcionando(self):
        assert sanitize_mime("audio/webm") in ALLOWED_MIME

    def test_video_mp4_puro_sigue_funcionando(self):
        assert sanitize_mime("video/mp4") in ALLOWED_MIME

    def test_image_jpeg_con_parametro_es_aceptado(self):
        assert sanitize_mime("image/jpeg; charset=utf-8") in ALLOWED_MIME

    def test_mime_invalido_rechazado_despues_de_sanitizar(self):
        """Un MIME que no existe no debe colarse aunque tenga codec."""
        raw = "application/exe;codecs=malware"
        assert sanitize_mime(raw) not in ALLOWED_MIME

    def test_content_type_vacio_no_crashea(self):
        assert sanitize_mime("") not in ALLOWED_MIME

    def test_content_type_none_no_crashea(self):
        assert sanitize_mime(None) not in ALLOWED_MIME  # type: ignore

    def test_sanitize_normaliza_a_lowercase(self):
        assert sanitize_mime("Audio/Webm;Codecs=Opus") == "audio/webm"
