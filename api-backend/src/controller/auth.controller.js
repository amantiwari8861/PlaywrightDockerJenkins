import bcrypt from "bcryptjs";
import User from "../model/user.model.js";
import { generateToken } from "../util/jwt.util.js";

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required.",
      });
    }

    const userInDb = await User.findOne({ email });
    if (!userInDb) {
      return res.status(404).json({
        success: false,
        message: "Account Doesn't Exist!",
      });
    }

    if (!bcrypt.compareSync(password, userInDb.password)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Credentials!",
      });
    }

    const token = generateToken({
      email: userInDb.email,
      name: userInDb.name,
      role: "ROLE_USER",
    });

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: "Logged In Succesfully!",
      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email and password are required.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Account Already Exists!",
      });
    }

    // Allow-list the fields so callers cannot inject extra document keys.
    const user = new User({
      name,
      email,
      password: bcrypt.hashSync(password, 10),
    });

    const savedUser = await user.save();
    if (!savedUser) {
      return res.status(400).json({
        success: false,
        message: "unable to register user!",
      });
    }

    const userObject = savedUser.toObject();
    delete userObject.password;

    res.status(201).json({
      success: true,
      message: "user registered succesfully!",
      data: userObject,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export { loginUser, registerUser };
