import {Router} from "express";
import {requireAuth} from "../../middlewares/auth.middleware.ts";
import * as fieldController from "./field.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/",fieldController.createFieldHandler);
router.get("/",fieldController.getFieldsHandler);
router.get("/:fieldId",fieldController.getFieldHandler);
router.put("/:fieldId",fieldController.udpateFieldHandler);
router.delete("/:fieldId",fieldController.deleteFieldHandler);

export default router;