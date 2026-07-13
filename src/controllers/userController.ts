import * as userService from '@/services/userService';
import { asyncHandler } from '@/utils/handler';
import { success } from '@/utils/response';
import { validate } from '@/utils/validate';
import { idSchema } from '@/validators/commonValidators';
import { userEditSchema, userQuerySchema, userSchema } from '@/validators/userValidators';

// 获取当前登录用户的信息
export const getUserInfo = asyncHandler(async (req, res) => {
  const user = await userService.getUserInfo(req.userId!);
  success(res, user);
});

// 获取当前登录用户的菜单
export const getMenus = asyncHandler(async (req, res) => {
  const data = await userService.getUserMenus(req.userId!);
  success(res, data);
});

// 获取用户列表
export const getUserList = asyncHandler(async (req, res) => {
  const query = validate(userQuerySchema, req.query);
  const role = await userService.getUserList(query);
  success(res, role);
});

// 新增用户
export const addUser = asyncHandler(async (req, res) => {
  const data = validate(userSchema, req.body);
  await userService.addUser(data);
  success(res);
});

// 编辑用户
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = validate(idSchema, req.params);
  const data = validate(userEditSchema, req.body);
  await userService.updateUser(id, data);
  success(res);
});

// 删除用户
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = validate(idSchema, req.params);
  await userService.deleteUser(id);
  success(res);
});
