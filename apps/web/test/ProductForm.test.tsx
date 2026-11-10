import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@markethub/shared";
import { ProductForm } from "@/components/ProductForm";
import { renderWithClient } from "./render";

const photo = new File(["jpg-bytes"], "pan.jpg", { type: "image/jpeg" });
const existing: Product = { id: 5, shopId: 1, name: "Barra de pan", description: "Recién hecha", imageUrl: "/uploads/pan.jpg", stock: 12 };

function renderForm(props: Partial<Parameters<typeof ProductForm>[0]> = {}) {
  const onSubmit = vi.fn<(data: FormData) => Promise<unknown>>().mockResolvedValue(undefined);
  const result = renderWithClient(<ProductForm submitLabel="Añadir producto" onSubmit={onSubmit} {...props} />);
  return { ...result, onSubmit: (props.onSubmit as typeof onSubmit | undefined) ?? onSubmit };
}

const sent = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls[0]![0] as FormData;

describe("ProductForm — create", () => {
  it("sends name, description and stock, without an image when none is chosen", async () => {
    const { user, onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nombre"), "Croissant");
    await user.clear(screen.getByLabelText("Cantidad"));
    await user.type(screen.getByLabelText("Cantidad"), "8");
    await user.type(screen.getByLabelText("Descripción"), "De mantequilla");
    await user.click(screen.getByRole("button", { name: "Añadir producto" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(Object.fromEntries(sent(onSubmit))).toEqual({ name: "Croissant", stock: "8", description: "De mantequilla" });
  });

  it("starts with a stock of 0", () => {
    renderForm();
    expect(screen.getByLabelText("Cantidad")).toHaveValue(0);
  });

  it("includes the image when one is chosen", async () => {
    const { user, onSubmit } = renderForm();
    await user.type(screen.getByLabelText("Nombre"), "Pan");
    await user.upload(screen.getByLabelText("Imagen del producto"), photo);
    await user.click(screen.getByRole("button", { name: "Añadir producto" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect((sent(onSubmit).get("image") as File).name).toBe("pan.jpg");
  });

  it("clears the form after a successful create, ready for the next product", async () => {
    const { user } = renderForm();
    await user.type(screen.getByLabelText("Nombre"), "Croissant");
    await user.type(screen.getByLabelText("Descripción"), "De mantequilla");
    await user.click(screen.getByRole("button", { name: "Añadir producto" }));

    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveValue(""));
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
    expect(screen.getByLabelText("Cantidad")).toHaveValue(0);
  });

  it("keeps the values and shows the error when saving fails", async () => {
    const { user } = renderForm({ onSubmit: vi.fn().mockRejectedValue(new Error("La cantidad no puede ser negativa")) });
    await user.type(screen.getByLabelText("Nombre"), "Croissant");
    await user.click(screen.getByRole("button", { name: "Añadir producto" }));

    expect(await screen.findByText("La cantidad no puede ser negativa")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Croissant");
    expect(screen.getByRole("button", { name: "Añadir producto" })).toBeEnabled();
  });

  it("gives each form its own field ids, so two forms on one page don't clash", () => {
    renderWithClient(
      <>
        <ProductForm submitLabel="A" onSubmit={vi.fn()} />
        <ProductForm submitLabel="B" onSubmit={vi.fn()} product={existing} />
      </>,
    );
    const names = screen.getAllByLabelText("Nombre");
    expect(names).toHaveLength(2);
    expect(names[0]!.id).not.toBe(names[1]!.id);
  });
});

describe("ProductForm — edit", () => {
  it("is prefilled with the product", () => {
    renderForm({ product: existing, submitLabel: "Guardar" });
    expect(screen.getByLabelText("Nombre")).toHaveValue("Barra de pan");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Recién hecha");
    expect(screen.getByLabelText("Cantidad")).toHaveValue(12);
    expect(screen.getByRole("img", { name: "Vista previa" })).toHaveAttribute("src", "/uploads/pan.jpg");
  });

  it("doesn't clear the form after saving", async () => {
    const { user, onSubmit } = renderForm({ product: existing, submitLabel: "Guardar" });
    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Pan integral");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(sent(onSubmit).has("image")).toBe(false);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Pan integral");
  });

  it("calls onCancel", async () => {
    const onCancel = vi.fn();
    const { user } = renderForm({ product: existing, submitLabel: "Guardar", onCancel });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
