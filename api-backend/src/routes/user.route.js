import express from "express";
import {
  deleteUserById,
  editUserById,
  getAllUsers,
  getUserById,
  saveUser,
} from "../controller/user.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const userRouter = express.Router();

userRouter.get("/greet", (req, res) => {
  // http://localhost:5000/api/v1/user/greet
  res.send("Good Afternoon Sir!");
});
userRouter.use(authMiddleware);
userRouter.get("/", getAllUsers); //  http://localhost:5000/api/v1/user
userRouter.get("/:id", getUserById); // http://localhost:5000/api/v1/user/:id
userRouter.post("/", saveUser); //  http://localhost:5000/api/v1/user + Body
userRouter.put("/:id", editUserById); //  http://localhost:5000/api/v1/user/:id + Body
userRouter.delete("/:id", deleteUserById); //  http://localhost:5000/api/v1/user/:id

export default userRouter;
