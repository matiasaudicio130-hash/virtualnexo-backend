import "@testing-library/jest-dom";

// Stub de APIs del navegador no disponibles en jsdom
// Preservamos el constructor URL de jsdom y sólo sobreescribimos los métodos estáticos ausentes
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:mock";
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = () => {};
}

// Silenciar console.error de React en tests (componentes con mocks parciales)
const originalError = console.error.bind(console.error);
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("Warning:")) return;
    originalError(...args);
  };
});
afterAll(() => { console.error = originalError; });
