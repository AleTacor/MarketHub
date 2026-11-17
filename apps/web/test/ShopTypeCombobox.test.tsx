import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ShopType } from "@markethub/shared";
import { ShopTypeCombobox } from "@/components/ShopTypeCombobox";

const TYPES: ShopType[] = [
  { id: 1, name: "Clínica y centro médico" },
  { id: 2, name: "Dentista" },
  { id: 3, name: "Taller mecánico" },
  { id: 4, name: "Otros" },
];

/** Controlled like the real callers; `onChange` records every change. */
function setup({ emptyLabel, initial = null }: { emptyLabel?: string; initial?: number | null } = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState<number | null>(initial);
    return (
      <form onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="type">Tipo de negocio</label>
        <ShopTypeCombobox
          id="type"
          name="shopTypeId"
          types={TYPES}
          value={value}
          emptyLabel={emptyLabel}
          onChange={(id) => {
            onChange(id);
            setValue(id);
          }}
        />
        <button type="button">Otro campo</button>
      </form>
    );
  }
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Tipo de negocio" });
  const hidden = () => container.querySelector<HTMLInputElement>('input[type=hidden][name="shopTypeId"]')!;
  const optionNames = () => screen.queryAllByRole("option").map((o) => o.textContent);
  return { user, input, onChange, hidden, optionNames };
}

describe("ShopTypeCombobox", () => {
  it("opens on click with every type, and picks one", async () => {
    const { user, input, onChange, hidden, optionNames } = setup();
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(optionNames()).toEqual(["Clínica y centro médico", "Dentista", "Taller mecánico", "Otros"]);
    await user.click(screen.getByRole("option", { name: "Dentista" }));

    expect(onChange).toHaveBeenCalledWith(2);
    expect(input).toHaveValue("Dentista");
    expect(hidden()).toHaveValue("2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters as you type, ignoring case and accents", async () => {
    const { user, input, optionNames } = setup();
    await user.type(input, "CLINICA");
    expect(optionNames()).toEqual(["Clínica y centro médico"]);

    await user.clear(input);
    await user.type(input, "ta");
    expect(optionNames()).toEqual(["Dentista", "Taller mecánico"]); // anywhere in the name
  });

  it("says when nothing matches", async () => {
    const { user, input, optionNames } = setup();
    await user.type(input, "hotel");
    expect(optionNames()).toEqual([]);
    expect(screen.getByText("Ningún tipo coincide")).toBeInTheDocument();
  });

  it("moves with the arrow keys and picks with Enter (without submitting)", async () => {
    const { user, input, onChange } = setup();
    await user.click(input);
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0]!.id);

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Taller mecánico" }).id);
    await user.keyboard("{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith(2);
    expect(input).toHaveValue("Dentista");
  });

  it("Escape closes and goes back to the current choice", async () => {
    const { user, input, onChange } = setup({ initial: 3 });
    await user.type(input, "den");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Taller mecánico");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("on leaving, keeps an exactly typed name and drops anything else", async () => {
    const { user, input, onChange } = setup({ initial: 3 });
    await user.clear(input);
    await user.type(input, "dentista");
    await user.click(screen.getByRole("button", { name: "Otro campo" }));
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(input).toHaveValue("Dentista");

    await user.clear(input);
    await user.type(input, "dent");
    await user.click(screen.getByRole("button", { name: "Otro campo" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("Dentista");
  });

  describe("with an empty option", () => {
    it("lists it first, uses it as placeholder, and picks it", async () => {
      const { user, input, onChange, hidden, optionNames } = setup({ emptyLabel: "Todos los tipos", initial: 2 });
      await user.click(input);
      expect(optionNames()[0]).toBe("Todos los tipos");
      expect(input).toHaveAttribute("placeholder", "Todos los tipos");

      await user.click(screen.getByRole("option", { name: "Todos los tipos" }));
      expect(onChange).toHaveBeenCalledWith(null);
      expect(input).toHaveValue("");
      expect(hidden()).toHaveValue("");
    });

    it("hides it while filtering, and clearing the text picks it", async () => {
      const { user, input, onChange, optionNames } = setup({ emptyLabel: "Todos los tipos", initial: 2 });
      await user.type(input, "taller");
      expect(optionNames()).toEqual(["Taller mecánico"]);

      await user.clear(input);
      await user.click(screen.getByRole("button", { name: "Otro campo" }));
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
