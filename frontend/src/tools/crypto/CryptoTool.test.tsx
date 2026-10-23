import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CryptoTool from "./CryptoTool";

describe("CryptoTool", () => {
  it("self-tests algorithms and executes AES without persisting secrets", async () => {
    const before = localStorage.length;
    render(<CryptoTool />);

    await waitFor(() => expect(screen.getByText("AES-128 ECB 通过")).toBeVisible());
    expect(screen.getByText("DES ECB 通过")).toBeVisible();
    expect(screen.getByText("3DES ECB 通过")).toBeVisible();
    expect(screen.getByText("SM3 通过")).toBeVisible();
    expect(screen.getByText("SM4 ECB 通过")).toBeVisible();
    expect(screen.getByLabelText("密码密钥")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "隐藏敏感字段" }));
    expect(screen.getByLabelText("密码密钥")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "显示敏感字段" }));
    expect(screen.getByLabelText("密码密钥")).toHaveAttribute("type", "text");

    fireEvent.change(screen.getByLabelText("密码输入"), { target: { value: "00112233445566778899AABBCCDDEEFF" } });
    fireEvent.change(screen.getByLabelText("输入格式"), { target: { value: "hex" } });
    fireEvent.change(screen.getByLabelText("密码密钥"), { target: { value: "000102030405060708090A0B0C0D0E0F" } });
    fireEvent.change(screen.getByDisplayValue("CBC"), { target: { value: "ecb" } });
    fireEvent.change(screen.getByDisplayValue("PKCS#7"), { target: { value: "none" } });
    fireEvent.change(screen.getByLabelText("预期计算结果"), { target: { value: "69 c4 e0 d8 6a 7b 04 30 d8 cd b7 80 70 b4 c5 5a" } });
    fireEvent.click(screen.getByRole("button", { name: "执行加密" }));

    await waitFor(() => expect(screen.getByLabelText("密码输出")).toHaveValue("69C4E0D86A7B0430D8CDB78070B4C55A"));
    expect(screen.getByRole("status")).toHaveTextContent("核对一致 · 16 字节");
    fireEvent.change(screen.getByLabelText("预期计算结果"), { target: { value: "00C4E0D86A7B0430D8CDB78070B4C55A" } });
    fireEvent.click(screen.getByRole("button", { name: "执行加密" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("首个差异位于字节偏移 0"));
    expect(screen.getByRole("status")).toHaveTextContent("计算值 0x69，预期值 0x00");
    expect(localStorage.length).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "清除敏感输入" }));
    expect(screen.getByLabelText("密码密钥")).toHaveValue("");
    expect(screen.getByLabelText("预期计算结果")).toHaveValue("");
    expect(screen.queryByLabelText("密码输出")).not.toBeInTheDocument();
  });

  it("calculates SM3 and HMAC through the digest workspace", async () => {
    render(<CryptoTool />);
    fireEvent.click(screen.getByRole("button", { name: "摘要与SM3" }));
    fireEvent.change(screen.getByDisplayValue("SHA-256"), { target: { value: "sm3" } });
    fireEvent.click(screen.getByRole("button", { name: "计算摘要" }));
    expect(screen.getByLabelText("摘要结果")).toHaveValue("66C7F0F462EEEDD9D1F2D46BDC10E4E24167C4875CF2F7A2297DA02B8F4BA8E0");
  });
});
