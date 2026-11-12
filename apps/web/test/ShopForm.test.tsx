import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShopForm } from "@/components/ShopForm";
import { recorder, server } from "./msw";
import { renderWithClient, shopDetail, skipNativeValidation } from "./render";

const PICKED = { lat: 40.4168, lng: -3.7038 };

// Leaflet can't run in jsdom: the fake map "clicks" a fixed point and exposes the current value.
vi.mock("@/components/maps", () => ({
  LocationPickerMap: ({
    value,
    onChange,
    focus,
  }: {
    value: { lat: number; lng: number } | null;
    onChange: (p: typeof PICKED) => void;
    focus?: { lat: number; lng: number } | null;
  }) => (
    <div
      data-testid="location-map"
      data-value={value ? `${value.lat},${value.lng}` : ""}
      data-focus={focus ? `${focus.lat},${focus.lng}` : ""}
    >
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
    expect(Object.fromEntries([...data].filter(([k]) => k !== "image" && !k.startsWith("reviewLinks") && !k.startsWith("phones")))).toEqual({
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

  it("counts the characters of name and description against their limits", async () => {
    const { user } = renderForm();
    await user.type(screen.getByLabelText("Nombre"), "Panadería Luna");
    expect(screen.getByLabelText("Nombre")).toHaveAccessibleDescription("14/100 caracteres");
    expect(screen.getByLabelText("Descripción")).toHaveAccessibleDescription("0/1000 caracteres");
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

  it("sends the review links, one field per platform", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user);
    await user.type(screen.getByLabelText("Tripadvisor"), "https://www.tripadvisor.es/Restaurant_Review-x");
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = sent(onSubmit);
    expect(data.get("reviewLinks[tripadvisor]")).toBe("https://www.tripadvisor.es/Restaurant_Review-x");
    expect(data.get("reviewLinks[google]")).toBe("");
  });

  it("sends up to three phones", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user);
    await user.type(screen.getByLabelText("Teléfono 1"), "612 345 678");
    await user.type(screen.getByLabelText("Teléfono 3"), "91 123 45 67");
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = sent(onSubmit);
    expect([0, 1, 2].map((i) => data.get(`phones[${i}]`))).toEqual(["612 345 678", "", "91 123 45 67"]);
    expect(screen.queryByLabelText("Teléfono 4")).not.toBeInTheDocument();
  });

  it("rejects an invalid phone before sending", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user);
    await user.type(screen.getByLabelText("Teléfono 2"), "1234");
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    expect(screen.getByText("Introduce un teléfono español válido (9 dígitos, p. ej. 912 345 678)")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers only review sites used in Spain", () => {
    renderForm();
    const group = screen.getByRole("group", { name: "Opiniones de clientes (opcional)" });
    expect(within(group).getAllByRole("textbox").map((i) => i.getAttribute("id"))).toEqual([
      "review-google",
      "review-tripadvisor",
      "review-thefork",
      "review-trustpilot",
      "review-facebook",
    ]);
  });

  it("rejects a review link to another site before sending", async () => {
    const { user, onSubmit } = renderForm();
    await fillFields(user);
    await user.type(screen.getByLabelText("Google Maps"), "https://example.com/opiniones");
    await user.click(screen.getByRole("button", { name: "Marcar ubicación" }));
    await user.click(submit());

    expect(screen.getByText("El enlace de Google Maps debe ser una dirección de google.com, google.es, goo.gl, g.page")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has no cancel button unless onCancel is given", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });
});

describe("ShopForm — edit", () => {
  const existing = shopDetail({
    name: "Frutería Sol",
    description: "Fruta de temporada",
    postalCode: "28013",
    shopType: { id: 2, name: "Frutería" },
    lat: 40.41,
    lng: -3.71,
    imageUrl: "/uploads/sol.png",
    reviewLinks: { google: "https://maps.app.goo.gl/Sol" },
    phones: ["912345678"],
  });

  it("is prefilled with the shop's data", async () => {
    renderForm({ shop: existing, submitLabel: "Guardar cambios" });

    expect(screen.getByLabelText("Nombre")).toHaveValue("Frutería Sol");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Fruta de temporada");
    expect(screen.getByLabelText("Código postal")).toHaveValue("28013");
    await waitFor(() => expect(screen.getByLabelText("Tipo de tienda")).toHaveValue("2"));
    expect(screen.getByTestId("location-map")).toHaveAttribute("data-value", "40.41,-3.71");
    expect(screen.getByRole("img", { name: "Vista previa" })).toHaveAttribute("src", "/uploads/sol.png");
    expect(screen.getByLabelText("Imagen de la tienda")).not.toBeRequired();
    expect(screen.getByLabelText("Google Maps")).toHaveValue("https://maps.app.goo.gl/Sol");
    expect(screen.getByLabelText("Tripadvisor")).toHaveValue("");
    expect(screen.getByLabelText("Teléfono 1")).toHaveValue("912 345 678");
    expect(screen.getByLabelText("Teléfono 2")).toHaveValue("");
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

describe("ShopForm — address search", () => {
  const MAYOR = { label: "Calle Mayor, 1, 28013 Madrid", lat: 40.4153, lng: -3.7074, postalCode: "28013", exact: true };
  const MAYOR_ALCALA = { label: "Calle Mayor, 1, 28801 Alcalá de Henares", lat: 40.4818, lng: -3.3644, postalCode: "28801", exact: true };
  const PAPA_NEGRO_STREET = { label: "Avenida del Papa Negro, Madrid", lat: 40.4532, lng: -3.6312, postalCode: null, exact: false };
  let geocodeCalls: ReturnType<typeof recorder>;

  const answer = (results: unknown[]) => {
    geocodeCalls = recorder();
    server.use(
      http.get("/api/geocode", async ({ request }) => {
        await geocodeCalls.record(request);
        return HttpResponse.json({ results });
      }),
    );
  };
  const addressInput = () => screen.getByLabelText("Dirección");
  const findButton = () => screen.getByRole("button", { name: "Buscar dirección" });
  const map = () => screen.getByTestId("location-map");

  it("places the shop at the only match, moves the map there and fills the postal code", async () => {
    answer([MAYOR]);
    const { user } = renderForm();
    await user.type(addressInput(), "Calle Mayor 1, Madrid");
    await user.click(findButton());

    await waitFor(() => expect(map()).toHaveAttribute("data-value", "40.4153,-3.7074"));
    expect(new URL(geocodeCalls.calls[0]!.url).searchParams.get("q")).toBe("Calle Mayor 1, Madrid");
    expect(map()).toHaveAttribute("data-focus", "40.4153,-3.7074");
    expect(screen.getByLabelText("Código postal")).toHaveValue("28013");
    expect(screen.getByRole("status")).toHaveTextContent("Ubicación marcada en Calle Mayor, 1, 28013 Madrid.");
  });

  it("asks to adjust the point on the map when the exact door wasn't found", async () => {
    answer([PAPA_NEGRO_STREET]);
    const { user } = renderForm();
    await user.type(addressInput(), "Avenida del Papa Negro 22, Madrid");
    await user.click(findButton());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "No hemos encontrado el número exacto: hemos marcado Avenida del Papa Negro, Madrid. Haz clic en el mapa en el punto exacto de la tienda.",
    );
    expect(map()).toHaveAttribute("data-value", "40.4532,-3.6312");
  });

  it("flags approximate matches in the list", async () => {
    answer([MAYOR, PAPA_NEGRO_STREET]);
    const { user } = renderForm();
    await user.type(addressInput(), "Madrid");
    await user.click(findButton());

    const list = await screen.findByRole("list", { name: "Direcciones encontradas" });
    expect(within(list).getByRole("button", { name: /^Avenida del Papa Negro, Madrid\s*· sin número exacto$/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: MAYOR.label })).toBeInTheDocument();
  });

  it("lets the owner choose when there are several matches", async () => {
    answer([MAYOR, MAYOR_ALCALA]);
    const { user } = renderForm();
    await user.type(addressInput(), "Calle Mayor 1");
    await user.click(findButton());

    const list = await screen.findByRole("list", { name: "Direcciones encontradas" });
    expect(map()).toHaveAttribute("data-value", "");
    await user.click(within(list).getByRole("button", { name: MAYOR_ALCALA.label }));

    expect(map()).toHaveAttribute("data-value", "40.4818,-3.3644");
    expect(screen.getByLabelText("Código postal")).toHaveValue("28801");
    expect(screen.queryByRole("list", { name: "Direcciones encontradas" })).not.toBeInTheDocument();
  });

  it("searches on Enter without submitting the shop form", async () => {
    answer([MAYOR]);
    const { user, onSubmit } = renderForm();
    await user.type(addressInput(), "Calle Mayor 1{Enter}");

    await waitFor(() => expect(map()).toHaveAttribute("data-value", "40.4153,-3.7074"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the typed postal code when the match has none", async () => {
    answer([{ ...MAYOR, postalCode: null }]);
    const { user } = renderForm();
    await user.type(screen.getByLabelText("Código postal"), "28001");
    await user.type(addressInput(), "Calle Mayor 1");
    await user.click(findButton());

    await waitFor(() => expect(map()).toHaveAttribute("data-value", "40.4153,-3.7074"));
    expect(screen.getByLabelText("Código postal")).toHaveValue("28001");
  });

  it("says so when nothing is found", async () => {
    answer([]);
    const { user } = renderForm();
    await user.type(addressInput(), "Calle Inventada 99");
    await user.click(findButton());

    expect(await screen.findByText(/No hemos encontrado esa dirección/)).toBeInTheDocument();
    expect(map()).toHaveAttribute("data-value", "");
  });

  it("shows the backend error", async () => {
    server.use(
      http.get("/api/geocode", () =>
        HttpResponse.json({ error: "No se pudo buscar la dirección. Inténtalo de nuevo o marca la ubicación en el mapa" }, { status: 502 }),
      ),
    );
    const { user } = renderForm();
    await user.type(addressInput(), "Calle Mayor 1");
    await user.click(findButton());

    expect(await screen.findByText(/No se pudo buscar la dirección/)).toBeInTheDocument();
  });

  it("can't search an empty address", () => {
    renderForm();
    expect(findButton()).toBeDisabled();
  });
});
