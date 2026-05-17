import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

const employeeItems = [
  { value: "emp-1", label: "Ana Souza" },
  { value: "emp-2", label: "Reginatto Silva" },
  { value: "emp-3", label: "Carlos Lima" },
];

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  });

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("SearchableCombobox", () => {
  it("filtra por parte do nome, seleciona funcionário, exibe o nome escolhido e fecha a lista", async () => {
    const handleValueChange = vi.fn();
    const { rerender } = render(
      <SearchableCombobox
        value=""
        items={employeeItems}
        placeholder="Pesquisar funcionário..."
        searchPlaceholder="Pesquisar funcionário..."
        emptyMessage="Nenhum funcionário encontrado"
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.change(screen.getByPlaceholderText("Pesquisar funcionário..."), { target: { value: "reg" } });

    expect(within(listbox).getByText("Reginatto Silva")).toBeInTheDocument();
    await waitFor(() => expect(within(listbox).queryByText("Ana Souza")).not.toBeInTheDocument());
    await waitFor(() => expect(within(listbox).queryByText("Carlos Lima")).not.toBeInTheDocument());

    fireEvent.click(within(listbox).getByText("Reginatto Silva"));
    expect(handleValueChange).toHaveBeenCalledWith("emp-2");

    rerender(
      <SearchableCombobox
        value="emp-2"
        items={employeeItems}
        placeholder="Pesquisar funcionário..."
        searchPlaceholder="Pesquisar funcionário..."
        emptyMessage="Nenhum funcionário encontrado"
        onValueChange={handleValueChange}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Reginatto Silva");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando a busca não encontra funcionário", async () => {
    render(
      <SearchableCombobox
        value=""
        items={employeeItems}
        placeholder="Pesquisar funcionário..."
        searchPlaceholder="Pesquisar funcionário..."
        emptyMessage="Nenhum funcionário encontrado"
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(await screen.findByPlaceholderText("Pesquisar funcionário..."), { target: { value: "zzz" } });

    expect(await screen.findByText("Nenhum funcionário encontrado")).toBeInTheDocument();
  });
});
