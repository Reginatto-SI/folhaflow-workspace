import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  rowIndex: number;
  colIndex: number;
  onNavigate: (row: number, col: number) => void;
  isActive: boolean;
  setActive: () => void;
  className?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onChange,
  onCommit,
  rowIndex,
  colIndex,
  onNavigate,
  isActive,
  setActive,
  className,
}) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  const formatCurrency = (num: number) =>
    num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Comentário: no modo edição não aplicamos máscara monetária (sem símbolo/agrupamento),
  // para preservar experiência de digitação livre estilo Excel.
  const formatEditable = (num: number) => `${Number.isFinite(num) ? num : 0}`.replace(".", ",");

  const parseCurrency = (raw: string) => {
    const normalized = raw.trim();
    if (!normalized) return 0;
    const keepsNumericTokens = normalized.replace(/[^\d,.-]/g, "");
    const withoutThousands = keepsNumericTokens.replace(/\./g, "");
    const decimalNormalized = withoutThousands.replace(/,/g, ".");
    const parsed = Number(decimalNormalized);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  useEffect(() => {
    if (isActive && !editing) {
      cellRef.current?.focus();
    }
  }, [isActive, editing]);

  useEffect(() => {
    if (editing) {
      setTempValue(formatEditable(value));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  const commit = () => {
    const num = parseCurrency(tempValue);
    onChange(num);
    onCommit?.(num);
    setEditing(false);
    setTempValue(formatCurrency(num));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editing) {
      const isDirectTypingKey = /^[0-9,.-]$/.test(e.key);
      if (isDirectTypingKey) {
        e.preventDefault();
        setEditing(true);
        setTempValue(e.key);
      } else if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        setEditing(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate(rowIndex + 1, colIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate(rowIndex - 1, colIndex);
      } else if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        onNavigate(rowIndex, colIndex + 1);
      } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        onNavigate(rowIndex, colIndex - 1);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      onNavigate(rowIndex + 1, colIndex);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit();
      onNavigate(rowIndex, e.shiftKey ? colIndex - 1 : colIndex + 1);
    } else if (e.key === "Escape") {
      setEditing(false);
      setTempValue(String(value));
    }
  };

  const formatted = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <td
      ref={cellRef}
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        setActive();
        setEditing(true);
      }}
      onFocus={setActive}
      onKeyDown={handleKeyDown}
      className={cn(
        "px-3 py-2 text-right tabular-nums cursor-pointer transition-colors duration-200 border-r border-border last:border-r-0",
        isActive && !editing && "ring-2 ring-inset ring-secondary bg-secondary/5",
        editing && "p-0"
      )}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => {
            const nextText = e.target.value;
            setTempValue(nextText);
            onChange(parseCurrency(nextText));
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(event) => event.stopPropagation()}
          autoComplete="off"
          className="w-full h-full px-3 py-2 text-right tabular-nums bg-secondary/10 outline-none border-2 border-secondary rounded-sm text-sm"
        />
      ) : (
        <span className={cn("text-sm", className)}>{formatted}</span>
      )}
    </td>
  );
};

export default EditableCell;
