/**
 * FU-02 - `components/ui` phai cho moi control ten accessible.
 *
 * A11Y-9 con 45 diem, nhung tap trung: 5 diem nam trong `components/ui`
 * (primitive dung o moi trang). Sua primitive = 1 cho nhieu man hinh.
 *
 * `placeholder` KHONG phai accessible name theo WCAG. Truoc khi sua:
 *   - `command.tsx` input tim kiem chi co `placeholder` => screen reader doc "edit text"
 *   - `input-otp.tsx` tao N `<input>` ma khong o nao co ten => 6 o doc chung
 *     mot cai ten
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Command, CommandInput } from "../command";
import { InputOtp } from "../input-otp";

/** Ten accessible = aria-label (fallback placeholder). */
function accName(el: HTMLElement): string {
  return (el.getAttribute("aria-label") ?? "").trim();
}

describe("ui/command — ten accessible", () => {
  test("input tim kiem co aria-label", () => {
    render(<Command value="" onValueChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(accName(input)).not.toBe("");
  });

  test("fallback ve placeholder khi caller khong truyen aria-label", () => {
    render(<Command value="" onValueChange={() => {}} placeholder="Tìm trang" />);
    const input = screen.getByRole("textbox");
    expect(accName(input)).toBe("Tìm trang");
  });

  test("aria-label do caller truyen duoc uu tien", () => {
    render(<Command value="" onValueChange={() => {}} placeholder="Tìm" aria-label="Tìm danh mục" />);
    expect(accName(screen.getByRole("textbox"))).toBe("Tìm danh mục");
  });

  test("aria-label KHONG bi truyen nham cho div bao", () => {
    const { container } = render(<Command value="" onValueChange={() => {}} aria-label="Tim kiem" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(accName(root)).toBe("");
  });

  test("CommandInput cung co ten accessible", () => {
    render(<CommandInput placeholder="Nhap" />);
    expect(accName(screen.getByRole("textbox"))).toBe("Nhap");
  });
});

describe("ui/input-otp — moi o co ten rieng", () => {
  test("6 o co 6 ten khac nhau", () => {
    render(<InputOtp length={6} />);
    const boxes = screen.getAllByRole("textbox");
    expect(boxes).toHaveLength(6);
    const names = boxes.map(accName);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(6);
  });

  test("nhan i18n qua prop digitLabel", () => {
    render(<InputOtp length={3} digitLabel="Chữ số" />);
    expect(screen.getAllByRole("textbox").map(accName)).toEqual([
      "Chữ số 1",
      "Chữ số 2",
      "Chữ số 3",
    ]);
  });

  test("onChange van hoat dong", () => {
    const onChange = vi.fn();
    render(<InputOtp length={4} onChange={onChange} />);
    const first = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    const { fireEvent } = require("@testing-library/react");
    fireEvent.change(first, { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith("7");
  });
});
