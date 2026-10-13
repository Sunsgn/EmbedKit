import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DbcTool from "./DbcTool";

const dbc = `BO_ 256 Engine: 8 ECU
 SG_ Speed : 0|16@1+ (0.1,0) [0|250] "km/h" Dash
 SG_ Temp : 23|8@0- (1,-40) [-40|215] "C" Dash`;

describe("DBC batch log workflow", () => {
  it("decodes real log rows, isolates malformed input, filters, and enables export", async () => {
    render(<DbcTool />);
    const file = new File(["dbc"], "vehicle.dbc", { type: "text/plain" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue(dbc),
    });
    fireEvent.change(screen.getByLabelText("导入 DBC 文件"), {
      target: { files: [file] },
    });
    expect(await screen.findByText(/1 消息 \/ 2 信号/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("批量 CAN 日志"), {
      target: { value: "(1.0) can0 100#E803FF0000000000\nbad row" },
    });
    expect(await screen.findByText("有效帧 1")).toBeVisible();
    expect(screen.getByText("坏行 1")).toBeVisible();
    expect(screen.getByText("越界信号 1")).toBeVisible();
    expect(screen.getByText("Engine / Speed")).toBeVisible();
    expect(screen.getByRole("button", { name: "导出全部 CSV" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("日志 CAN ID 筛选"), {
      target: { value: "123" },
    });
    expect(await screen.findByText("筛选后 0")).toBeVisible();
    expect(screen.getByText(/没有可由当前 DBC 解码/)).toBeVisible();
  });
});
