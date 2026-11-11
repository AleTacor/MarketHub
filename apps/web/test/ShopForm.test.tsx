import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShopForm } from "@/components/ShopForm";
import { server } from "./msw";
import { renderWithClient, shopDetail, skipNativeValidation } from "./render";

const PICKED = { lat: 40.4168, lng: -3.7038 };

// Leaflet can't run in jsdom: the fake map "clicks" a fixed point and exposes the current value.
vi.mock("@/components/maps", () => ({
  LocationPickerMap: ({ value, onChange }: { value: { lat: number; lng: number } | null; onChange: (p: typeof PICKED) => void }) => (
    <div data-testid="location-map" data-value={value ? `${value.lat},${value.lng}` : ""}>
      <button type="button" onClick={() => onChange(PICKED)}>
        Marcar ubicación
      </button>
    </div>
  ),
}));
vi.mock("@/components/ImageCropDialog", async () => (await import("./imageCrop")).imageCropMock);

beforeEach(() => {
  server.use(
    http.get("/api/shop-types", () =>
      HttpResponse.json({ shopTypes: [{ id: 1, name: "Panadería y pastelería" }, { id: 2, name: "Frutería" }] }),
    ),
  );
});

const image = new File(["png-bytes"], "tienda.png", { type: "image/png" });

function renderForm(props: Partial<Parameters<typeof ShopForm>[0]> = {}) {
  const onSubmit = vi.fn<(data: FormData) => Promise<unknown>>().mockResolvedValue(undefined);
  const result = renderWithClient(<ShopForm submitLabel="Crear tienda" onSubmit={onSubmit} {...props} />);
  return { ...result, onSubmit: (props.onSubmit as typeof onSubmit | undefined) ?? onSubmit };
}

/** Fills every field except the location. */
async function fillFields(user: ReturnType<typeof renderForm>["user"], { postalCode = "28001" } = {}) {
  await user.type(screen.getByLabelText("Nombre"), "Panadería Luna");
  await user.type(screen.getByLabelText("Descripción"), "Pan de masa madre");
  await user.type(screen.getByLabelText("Código postal"), postalCode);
  await user.selectOptions(screen.getByLabelText("Tipo de tienda"), await screen.findByRole("option", { name: "Frutería" }));
  await user.upload(screen.getByLabelText("Imagen de la tienda"), image);
  await user.click(screen.getByRole("button", { name: "Aplicar recorte" }));
  skipNativeValidation(screen.getByLabelText("Nombre"));
}

const submit = () => screen.getByRole("button", { name: "Crear tienda" });
const sent = (onSubmit: ReturnType<typeof renderForm>["onSubmit"]) => onSubmit.mock.calls[0]![0];

describe("ShopForm — create", () => {
  it("loads the shop types from the API", async () => {
    renderForm();
    expect(await screen.findByRole("option", { name: "Panadería y pastelería" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Frutería" })).toBeInTheDocument();
  });

  it("sends every field, the location and the image as FormData", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user);
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = sent(onSubmit);
    expect(Object.fromEntries([...data].filter(([k]) => k !== "image"))).toEqual({
      name: "Panadería Luna",
      description: "Pan de masa madre",
      postalCode: "28001",
      shopTypeId: "2",
      lat: "40.4168",
      lng: "-3.7038",
    });
    expect(data.get("image")).toBeInstanceOf(File);
    expect((data.get("image") as File).name).toBe("recortada-tienda.png"); // the cropped file, not the original
  });

  it("requires a location on the map", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user);
    await user.click(submit());

    expect(screen.getByText("Marca en el mapa dónde está la tienda")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates the postal code before sending", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user, { postalCode: "99999" });
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    expect(screen.getByText(/Introduce un código postal español válido/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires an image when creating", () => {
    renderForm();
    expect(screen.getByLabelText("Imagen de la tienda")).toBeRequired();
  });

  it("asks to crop the selected image to the shop ratio (16:9) and previews the crop", async () => {
    const { user } = renderForm();
    await user.upload(screen.getByLabelText("Imagen de la tienda"), image);

    expect(screen.getByRole("dialog", { name: "Recortar imagen" })).toHaveAttribute("data-aspect", String(16 / 9));
    expect(screen.queryByRole("img", { name: "Vista previa" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aplicar recorte" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Vista previa" })).toHaveAttribute("src", "blob:preview/recortada-tienda.png");
  });

  it("lets the crop be adjusted again", async () => {
    const { user } = renderForm();
    await user.upload(screen.getByLabelText("Imagen de la tienda"), image);
    await user.click(screen.getByRole("button", { name: "Aplicar recorte" }));

    await user.click(screen.getByRole("button", { name: "Ajustar recorte" }));
    expect(screen.getByRole("dialog", { name: "Recortar imagen" })).toBeInTheDocument();
  });

  it("drops the pick when the crop is cancelled", async () => {
    const { user } = renderForm();
    const field = screen.getByLabelText<HTMLInputElement>("Imagen de la tienda");
    await user.upload(field, image);
    await user.click(screen.getByRole("button", { name: "Cancelar recorte" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(field.value).toBe("");
    expect(screen.queryByRole("img", { name: "Vista previa" })).not.toBeInTheDocument();
  });

  it("shows the backend error and re-enables the button", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("El tipo de tienda no existe"));
    const { user } = renderForm({ onSubmit });
    await fillFields(user);
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    expect(await screen.findByText("El tipo de tienda no existe")).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("disables the button while saving", async () => {
    let finish!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user } = renderForm({ onSubmit });
    await fillFields(user);
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    finish();
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("has no cancel button unless onCancel is given", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });
});

describe("ShopForm — edit", () => {
  const existing = shopDetail({ name: "Frutería Sol", description: "Fruta de temporada", postalCode: "28013", shopType: { id: 2, name: "Frutería" }, lat: 40.41, lng: -3.71, imageUrl: "/uploads/sol.png" });

  it("is prefilled with the shop's data", async () => {
    renderForm({ shop: existing, submitLabel: "Guardar cambios" });

    expect(screen.getByLabelText("Nombre")).toHaveValue("Frutería Sol");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Fruta de temporada");
    expect(screen.getByLabelText("Código postal")).toHaveValue("28013");
    await waitFor(() => expect(screen.getByLabelText("Tipo de tienda")).toHaveValue("2"));
    expect(screen.getByTestId("location-map")).toHaveAttribute("data-value", "40.41,-3.71");
    expect(screen.getByRole("img", { name: "Vista previa" })).toHaveAttribute("src", "/uploads/sol.png");
    expect(screen.getByLabelText("Imagen de la tienda")).not.toBeRequired();
  });

  it("keeps the location and omits the image when it isn't changed", async () => {
    const { user, onSubmit } = renderForm({ shop: existing, submitLabel: "Guardar cambios" });
    await screen.findByRole("option", { name: "Frutería" });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const data = sent(onSubmit);
    expect(data.has("image")).toBe(false);
    expect(data.get("lat")).toBe("40.41");
    expect(data.get("lng")).toBe("-3.71");
  });

  it("calls onCancel", async () => {
    const onCancel = vi.fn();
    const { user } = renderForm({ shop: existing, submitLabel: "Guardar cambios", onCancel });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
