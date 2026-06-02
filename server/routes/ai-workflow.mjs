import { Router } from "express";
import { listWorkflowPresets, runWorkflow } from "../lib/ai-workflow.mjs";
import { resolveChatConfig } from "../lib/chat-config.mjs";
import { HttpError, sendError } from "../lib/http-error.mjs";

const router = Router();

router.get("/capabilities", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(resolveChatConfig()),
    workflows: listWorkflowPresets(),
  });
});

router.post("/run", async (req, res) => {
  try {
    const { workflowId, input, stepIndex, previousOutputs, runAll } = req.body ?? {};
    const result = await runWorkflow({
      workflowId,
      input,
      stepIndex,
      previousOutputs,
      runAll: Boolean(runAll),
    });
    res.json({
      ok: true,
      ...result,
      message: result.completed ? "工作流已完成" : "步骤执行完成",
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
