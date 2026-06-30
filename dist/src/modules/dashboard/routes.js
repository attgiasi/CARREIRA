import { Router } from "express";
import { dashboardHtml } from "./views.js";
export const dashboardRouter = Router();
dashboardRouter.get("/", (_req, res) => {
    res.type("html").send(dashboardHtml());
});
