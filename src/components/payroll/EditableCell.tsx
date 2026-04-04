import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: number;
  onChange: (value: number) => void;
  rowIndex: number;
  colIndex: number;
  onNavigate: (row: number, col: number) => void;
  isActive: boolean;
  setActive: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  onChange,
  rowIndex,
  colIndex,
  onNavigate,
  isActive,
  setActive,
}) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (isActive && !editing) {
      cellRef.current?.focus();
    }
  }, [isActive, editing]);

  useEffect(() => {
    if (editing) {
      setTempValue(String(value));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  const commit = () => {
    const num = parseFloat(tempValue) || 0;
    onChange(num);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editing) {
      if (e.key === "Enter" || e.key === "F2") {
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
      onClick={() => {
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
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-3 py-2 text-right tabular-nums bg-secondary/10 outline-none border-2 border-secondary rounded-sm text-sm"
        />
      ) : (
        <span className="text-sm">{formatted}</span>
      )}
    </td>
  );
};

export default EditableCell;
