import type { UserCreateData, UserQuery, UserUpdateData } from '@/types/user';
import prisma from '@/config/database';
import { hashPassword } from '@/utils/password';
import { buildTree } from '@/utils/tree';

// 获取当前登录用户的信息
export async function getUserInfo(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      nickname: true,
      phone: true,
      email: true,
      avatar: true,
      gender: true,
      isSystem: true,
    },
  });

  if (!user)
    throw new Error('用户不存在');

  // 获取用户的按钮权限
  const buttons = await prisma.menu.findMany({
    where: {
      type: 2,
      status: true,
      // 非管理员只能获取所拥有角色关联的按钮权限
      ...(!user.isSystem && {
        roles: {
          some: {
            role: {
              users: {
                some: { userId },
              },
            },
          },
        },
      }),
    },
    select: { perm: true },
  });

  return {
    userId,
    ...user,
    buttons: buttons.map(button => button.perm).filter((perm): perm is string => !!perm),
  };
}

// 获取当前登录用户的菜单
export async function getUserMenus(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw new Error('用户不存在');

  let menus;
  if (user.isSystem) {
    // 如果是管理员直接获取所有菜单
    menus = await prisma.menu.findMany({
      where: {
        type: { not: 2 },
      },
      orderBy: { sort: 'asc' },
    });
  }
  else {
    // 获取用户对应角色的菜单
    const [checkedMenus, allMenus] = await Promise.all([
      prisma.menu.findMany({
        where: {
          status: true,
          type: { not: 2 },
          roles: {
            some: {
              role: {
                users: {
                  some: { userId },
                },
              },
            },
          },
        },
        select: { id: true },
      }),
      prisma.menu.findMany({
        where: { status: true, type: { not: 2 } },
        orderBy: { sort: 'asc' },
      }),
    ]);

    // 某些菜单是半选，需要向上查询
    const menuById = new Map(allMenus.map(menu => [menu.id, menu]));
    const keepIds = new Set<number>();

    for (const { id } of checkedMenus) {
      let cur = menuById.get(id);
      while (cur && !keepIds.has(cur.id)) {
        keepIds.add(cur.id);
        cur = menuById.get(cur.parentId);
      }
    }

    menus = allMenus.filter(menu => keepIds.has(menu.id));
  }

  return buildTree(menus);
}

// 获取用户列表
export async function getUserList(query: UserQuery) {
  const { name, phone, status, page = 1, pageSize = 10 } = query;

  const where = {
    isSystem: false,
    ...(name && { name: { contains: name } }),
    ...(phone && { phone: { contains: phone } }),
    ...(status !== undefined && { status }),
  };

  // 开启事务，同时执行多个互不依赖的查询
  const [users, total] = await prisma.$transaction([
    // 查询当前页数据
    prisma.user.findMany({
      where,
      omit: { password: true },
      skip: (page - 1) * pageSize, // 当前页的前面有几页 * 每页几条
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { roles: { select: { roleId: true } } },
    }),
    // 查询总条数
    prisma.user.count({ where }),
  ]);

  const list = users.map(({ roles, ...user }) => ({
    ...user,
    roleIds: roles.map(role => role.roleId),
  }));

  return { list, total };
}

// 新增用户
export async function addUser(data: UserCreateData) {
  const { roleIds, ...userData } = data;

  // 处理密码
  userData.password = await hashPassword(userData.password);

  try {
    // 开启事务，使用同一个事务来操作数据
    return await prisma.$transaction(async (tx) => {
      // 新增用户
      const user = await tx.user.create({ data: userData });

      if (roleIds !== undefined && roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map(roleId => ({ userId: user.id, roleId })),
        });
      }

      return user;
    });
  }
  catch (error: any) {
    if (error.code === 'P2002')
      throw new Error('当前用户已存在');

    throw error;
  }
}

// 编辑用户
export async function updateUser(id: number, data: UserUpdateData) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user)
    throw new Error('用户不存在');

  if (user.isSystem)
    throw new Error('系统内置账号不可修改');

  const { roleIds, ...userData } = data;

  // 处理密码
  if (userData.password)
    userData.password = await hashPassword(userData.password);

  // 开启事务，使用同一个事务来操作数据
  return await prisma.$transaction(async (tx) => {
    // 更新用户信息
    const updated = await tx.user.update({
      where: { id },
      data: userData,
    });

    if (roleIds !== undefined) {
      // 删除旧的关联角色
      await tx.userRole.deleteMany({
        where: { userId: id },
      });

      // 插入新的关联角色
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map(roleId => ({ userId: id, roleId })),
        });
      }
    }

    return updated;
  });
}

// 删除用户
export async function deleteUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user)
    throw new Error('用户不存在');

  if (user.isSystem)
    throw new Error('系统内置账号不可删除');

  return prisma.user.delete({ where: { id } });
}
