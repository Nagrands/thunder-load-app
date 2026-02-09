beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});

  if (!document.getElementById("toast-container")) {
    const container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
});

afterAll(() => {
  console.log.mockRestore();
});
