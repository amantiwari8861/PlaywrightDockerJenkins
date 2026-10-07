import mongoose from "mongoose";
import User from "../model/user.model.js";
import bcrypt from "bcryptjs";
const FILTERABLE_FIELDS = ["name", "email"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getAllUsers = async (req, res) => {
  try {
    // Only allow primitive equality filters on known fields, so callers cannot
    // inject Mongo operators (e.g. ?email[$ne]=) through req.query.
    const query = {};
    for (const field of FILTERABLE_FIELDS) {
      const value = req.query[field];
      if (typeof value === "string" && value.trim() !== "") {
        query[field] = value.trim();
      }
    }

    const users = await User.find(query).select("-password");

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const saveUser = async (req, res) => {
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
        message: "Email already exists.",
      });
    }
    const hashedPassword = bcrypt.hashSync(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const userObject = user.toObject();
    delete userObject.password;

    res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: userObject,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const editUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const { name, email, password } = req.body;

    const updates = {};
    if (typeof name === "string") updates.name = name;
    if (typeof email === "string") updates.email = email;
    // Only rehash when a new password was actually supplied, otherwise a
    // partial update would store a hash of `undefined`.
    if (typeof password === "string" && password !== "") {
      updates.password = bcrypt.hashSync(password, 12);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update.",
      });
    }

    if (updates.email) {
      const existingUser = await User.findOne({ email: updates.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists.",
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      returnDocument: "after",
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { getAllUsers, getUserById, saveUser, editUserById, deleteUserById };
