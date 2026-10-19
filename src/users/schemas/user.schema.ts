import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserGender, UserRole } from '../../common/enums/auth.enum.js';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, id: false })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(UserGender),
  })
  gender!: UserGender;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(UserRole),
    default: UserRole.BUYER,
  })
  role!: UserRole;

  @Prop({ default: '' })
  image!: string;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash!: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
