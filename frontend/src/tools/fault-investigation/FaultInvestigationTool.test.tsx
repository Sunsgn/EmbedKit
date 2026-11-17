import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { deleteFaultInvestigationDatabaseForTests } from "../../services/faultInvestigationStore";
import FaultInvestigationTool from "./FaultInvestigationTool";

afterEach(() => deleteFaultInvestigationDatabaseForTests());

describe("fault investigation workflow", () => {
  it("turns a register log into persisted deterministic findings without requiring artifacts", async () => {
    render(
      <MemoryRouter>
        <FaultInvestigationTool />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("故障调查原始日志"), {
      target: {
        value:
          "R0=1 R1=2 R2=3 R3=4 R12=C LR=FFFFFFF9 PC=08000109 xPSR=01000000 CFSR=00008200 HFSR=40000000 BFAR=40005410",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "提取寄存器" }));
    fireEvent.click(screen.getByRole("button", { name: "执行调查" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "调查结果已生成并保存",
      ),
    );
    expect(screen.getByText(/PC 0x08000109/)).toBeInTheDocument();
    expect(screen.getByText(/PRECISERR/)).toBeInTheDocument();
    expect(screen.getByText(/未绑定 ELF/)).toBeInTheDocument();
  });
});
