import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  business_unique_id:string;
  username: string;
  email: string;
  password: string;
}

const UserSchema = new Schema<IUser>({
  business_unique_id: {type:String, required:true},
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
