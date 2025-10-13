const mongoose = require("mongoose");

const defaultActions = [
    "manage",
    "create",
    "read",
    "update",
    "delete",
    "view",
    "manage_all",
    "manage_own",
    "toggle_us"
  ];
  

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
    },
    actions: {
        type: [String],
        default: defaultActions,
      },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Permission = mongoose.model("Permission", permissionSchema);

module.exports = Permission;
