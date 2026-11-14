import { Types } from 'mongoose';
import { PrincipalType } from 'librechat-data-provider';
import { logger, isValidObjectIdString } from '@librechat/data-schemas';
import {
  TENANT_ACCOUNT_TYPES,
  TENANT_SEAT_CAPABILITIES,
  isSemanticMode,
  isTenantAccountType,
} from 'librechat-data-provider';
import type {
  AuditAction,
  AuditMetadata,
  IGroup,
  IUser,
  IConfig,
  CreateGroupRequest,
  UpdateGroupRequest,
  GroupFilterOptions,
  RecordAuditEntryInput,
  RecordAuditEntryOptions,
} from '@librechat/data-schemas';
import type { FilterQuery, ClientSession, DeleteResult } from 'mongoose';
import type { Response } from 'express';
import type { ValidationError } from '~/types/error';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';
import { buildAuditContext } from './context';

type GroupListFilter = Pick<GroupFilterOptions, 'source' | 'search' | 'accountType'>;

const VALID_GROUP_SOURCES: ReadonlySet<string> = new Set(['local', 'entra']);
const MAX_CREATE_MEMBER_IDS = 500;
const MAX_SEARCH_LENGTH = 200;
const MAX_NAME_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 500;
const MAX_AVATAR_LENGTH = 2000;
const MAX_EXTERNAL_ID_LENGTH = 500;

/**
 * The Family seat model: two adults and at most two children.
 *
 * The children exist so a parent can supervise what a minor sends and receives,
 * and so Study can be shared between a parent and a child. A Family group is
 * therefore four seats, and the counts are part of the product rather than an
 * accident of who happens to be enrolled.
 */
const MAX_FAMILY_ADULTS = 2;
const MAX_FAMILY_CHILDREN = 2;

interface GroupIdParams {
  id: string;
}

interface GroupMemberParams extends GroupIdParams {
  userId: string;
}

/**
 * Validate the entitlement fields a group carries.
 *
 * These mirror the One-API group of the same name, so a group that cannot be
 * expressed in the operator's model must not be accepted here either.
 */
function validateGroupEntitlement(
  body: Partial<CreateGroupRequest> | Partial<UpdateGroupRequest>,
): string | undefined {
  // null clears a group's seat type (demote to a plain group); an invalid
  // non-null string is rejected against the operator's catalogue.
  if (
    body.accountType !== undefined &&
    body.accountType !== null &&
    !isTenantAccountType(body.accountType)
  ) {
    return `accountType must be one of ${TENANT_ACCOUNT_TYPES.join(', ')}`;
  }
  if (body.familySeats !== undefined) {
    const { maxAdults, maxChildren } = body.familySeats;
    if (
      !Number.isInteger(maxAdults) ||
      !Number.isInteger(maxChildren) ||
      maxAdults < 0 ||
      maxChildren < 0 ||
      maxAdults > MAX_FAMILY_ADULTS ||
      maxChildren > MAX_FAMILY_CHILDREN
    ) {
      return `familySeats must be integers within 0-${MAX_FAMILY_ADULTS} adults and 0-${MAX_FAMILY_CHILDREN} children`;
    }
  }
  if (body.allowedCapabilities !== undefined) {
    const invalid = body.allowedCapabilities.filter(
      (capability) => !TENANT_SEAT_CAPABILITIES.includes(capability),
    );
    if (invalid.length > 0) {
      return `unsupported capability: ${invalid.join(', ')}`;
    }
  }
  if (body.allowedModes !== undefined) {
    const invalid = body.allowedModes.filter((mode) => !isSemanticMode(mode));
    if (invalid.length > 0) {
      return `unsupported mode: ${invalid.join(', ')}`;
    }
  }
  return undefined;
}

export interface AdminGroupsDeps {
  listGroups: (
    filter?: GroupListFilter & { limit?: number; offset?: number },
    session?: ClientSession,
  ) => Promise<IGroup[]>;
  countGroups: (filter?: GroupListFilter, session?: ClientSession) => Promise<number>;
  findGroupById: (
    groupId: string | Types.ObjectId,
    projection?: Record<string, 0 | 1>,
    session?: ClientSession,
  ) => Promise<IGroup | null>;
  createGroup: (groupData: Partial<IGroup>, session?: ClientSession) => Promise<IGroup>;
  updateGroupById: (
    groupId: string | Types.ObjectId,
    data: Partial<Pick<IGroup, 'name' | 'description' | 'email' | 'avatar'>>,
    session?: ClientSession,
  ) => Promise<IGroup | null>;
  deleteGroup: (
    groupId: string | Types.ObjectId,
    session?: ClientSession,
  ) => Promise<IGroup | null>;
  addUserToGroup: (
    userId: string | Types.ObjectId,
    groupId: string | Types.ObjectId,
    session?: ClientSession,
  ) => Promise<{ user: IUser; group: IGroup | null }>;
  removeUserFromGroup: (
    userId: string | Types.ObjectId,
    groupId: string | Types.ObjectId,
    session?: ClientSession,
  ) => Promise<{ user: IUser; group: IGroup | null }>;
  removeMemberById: (
    groupId: string | Types.ObjectId,
    memberId: string,
    session?: ClientSession,
  ) => Promise<IGroup | null>;
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
  ) => Promise<IUser[]>;
  deleteConfig: (
    principalType: PrincipalType,
    principalId: string | Types.ObjectId,
  ) => Promise<IConfig | null>;
  deleteAclEntries: (filter: {
    principalType: PrincipalType;
    principalId: string | Types.ObjectId;
  }) => Promise<DeleteResult>;
  recordAuditEntry?: (
    input: RecordAuditEntryInput,
    options?: RecordAuditEntryOptions,
  ) => Promise<unknown>;
}

export function createAdminGroupsHandlers(deps: AdminGroupsDeps): {
  listGroups: (req: ServerRequest, res: Response) => Promise<Response>;
  getGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  createGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  updateGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  deleteGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  getGroupMembers: (req: ServerRequest, res: Response) => Promise<Response>;
  addGroupMember: (req: ServerRequest, res: Response) => Promise<Response>;
  removeGroupMember: (req: ServerRequest, res: Response) => Promise<Response>;
} {
  const {
    listGroups,
    countGroups,
    findGroupById,
    createGroup,
    updateGroupById,
    deleteGroup,
    addUserToGroup,
    removeUserFromGroup,
    removeMemberById,
    findUsers,
    deleteConfig,
    deleteAclEntries,
    recordAuditEntry,
  } = deps;

  /** Emits one hash-chained audit entry for a group mutation. Fail-open with a
   * loud error, matching the role-deletion cascade: a create, update or delete
   * has already taken effect when the audit runs, and none of them can be
   * compensated by this handler, so a failed audit must not misreport the
   * mutation as failed to the caller. Sequential to keep the per-tenant hash
   * chain ordered. */
  async function emitGroupAudit(
    req: ServerRequest,
    action: AuditAction,
    group: Pick<IGroup, '_id' | 'name'>,
    metadata: AuditMetadata = {},
  ): Promise<void> {
    if (!recordAuditEntry) return;
    const user = req.user;
    const userId = user?._id?.toString() ?? user?.id;
    if (!user || !userId) return;
    try {
      await recordAuditEntry({
        action,
        outcome: 'success',
        severity: action === 'group.deleted' ? 'warning' : 'info',
        actor: {
          type: 'user',
          id: userId,
          name: user.name || user.username || user.email || userId,
        },
        target: {
          type: PrincipalType.GROUP,
          id: group._id?.toString(),
          name: group.name,
        },
        metadata,
        context: buildAuditContext(req),
      });
    } catch (err) {
      logger.error(`[adminGroups] ${action} audit failed after the mutation took effect`, err);
    }
  }

  async function listGroupsHandler(req: ServerRequest, res: Response) {
    try {
      const { search, source, accountType } = req.query as {
        search?: string;
        source?: string;
        accountType?: string;
      };
      const filter: GroupListFilter = {};
      if (source && VALID_GROUP_SOURCES.has(source)) {
        filter.source = source as IGroup['source'];
      }
      if (search && search.length > MAX_SEARCH_LENGTH) {
        return res
          .status(400)
          .json({ error: `search must not exceed ${MAX_SEARCH_LENGTH} characters` });
      }
      if (search) {
        filter.search = search;
      }
      if (accountType) {
        if (!isTenantAccountType(accountType)) {
          return res.status(400).json({
            error: `accountType must be one of ${TENANT_ACCOUNT_TYPES.join(', ')}`,
          });
        }
        filter.accountType = accountType;
      }
      const { limit, offset } = parsePagination(req.query);
      const [groups, total] = await Promise.all([
        listGroups({ ...filter, limit, offset }),
        countGroups(filter),
      ]);
      return res.status(200).json({ groups, total, limit, offset });
    } catch (error) {
      logger.error('[adminGroups] listGroups error:', error);
      return res.status(500).json({ error: 'Failed to list groups' });
    }
  }

  async function getGroupHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as GroupIdParams;
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid group ID format' });
      }
      const group = await findGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      return res.status(200).json({ group });
    } catch (error) {
      logger.error('[adminGroups] getGroup error:', error);
      return res.status(500).json({ error: 'Failed to get group' });
    }
  }

  async function createGroupHandler(req: ServerRequest, res: Response) {
    try {
      const body = req.body as CreateGroupRequest;
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (body.name.trim().length > MAX_NAME_LENGTH) {
        return res
          .status(400)
          .json({ error: `name must not exceed ${MAX_NAME_LENGTH} characters` });
      }
      if (body.source && !VALID_GROUP_SOURCES.has(body.source)) {
        return res.status(400).json({ error: 'Invalid source value' });
      }
      if (body.description && body.description.length > MAX_DESCRIPTION_LENGTH) {
        return res
          .status(400)
          .json({ error: `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` });
      }
      if (body.email && body.email.length > MAX_EMAIL_LENGTH) {
        return res
          .status(400)
          .json({ error: `email must not exceed ${MAX_EMAIL_LENGTH} characters` });
      }
      if (body.avatar && body.avatar.length > MAX_AVATAR_LENGTH) {
        return res
          .status(400)
          .json({ error: `avatar must not exceed ${MAX_AVATAR_LENGTH} characters` });
      }
      if (body.idOnTheSource && body.idOnTheSource.length > MAX_EXTERNAL_ID_LENGTH) {
        return res
          .status(400)
          .json({ error: `idOnTheSource must not exceed ${MAX_EXTERNAL_ID_LENGTH} characters` });
      }
      const entitlementError = validateGroupEntitlement(body);
      if (entitlementError) {
        return res.status(400).json({ error: entitlementError });
      }

      const rawIds = Array.isArray(body.memberIds) ? body.memberIds : [];
      if (rawIds.length > MAX_CREATE_MEMBER_IDS) {
        return res
          .status(400)
          .json({ error: `memberIds must not exceed ${MAX_CREATE_MEMBER_IDS} entries` });
      }
      let memberIds = rawIds;
      const objectIds = rawIds.filter(isValidObjectIdString);
      if (objectIds.length > 0) {
        const users = await findUsers({ _id: { $in: objectIds } }, 'idOnTheSource');
        const idMap = new Map<string, string>();
        for (const user of users) {
          const uid = user._id?.toString() ?? '';
          idMap.set(uid, user.idOnTheSource || uid);
        }
        const unmapped = objectIds.filter((oid) => !idMap.has(oid));
        if (unmapped.length > 0) {
          logger.warn(
            '[adminGroups] createGroup: memberIds contain unknown user ObjectIds:',
            unmapped,
          );
        }
        memberIds = rawIds.map((id) => idMap.get(id) || id);
      }

      const group = await createGroup({
        name: body.name.trim(),
        description: body.description,
        email: body.email,
        avatar: body.avatar,
        source: body.source || 'local',
        memberIds,
        ...(body.idOnTheSource ? { idOnTheSource: body.idOnTheSource } : {}),
        ...(body.accountType ? { accountType: body.accountType } : {}),
        ...(body.shared !== undefined ? { shared: body.shared } : {}),
        ...(body.familySeats ? { familySeats: body.familySeats } : {}),
        ...(body.localPrivacyEnabled !== undefined
          ? { localPrivacyEnabled: body.localPrivacyEnabled }
          : {}),
        ...(body.allowedCapabilities ? { allowedCapabilities: body.allowedCapabilities } : {}),
        ...(body.allowedModes ? { allowedModes: body.allowedModes } : {}),
      });
      await emitGroupAudit(req, 'group.created', group, {
        source: group.source ?? null,
        accountType: group.accountType ?? null,
        memberCount: memberIds.length,
      });
      return res.status(201).json({ group });
    } catch (error) {
      if ((error as ValidationError).name === 'ValidationError') {
        return res.status(400).json({ error: (error as ValidationError).message });
      }
      logger.error('[adminGroups] createGroup error:', error);
      return res.status(500).json({ error: 'Failed to create group' });
    }
  }

  async function updateGroupHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as GroupIdParams;
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid group ID format' });
      }
      const body = req.body as UpdateGroupRequest;

      if (
        body.name !== undefined &&
        (!body.name || typeof body.name !== 'string' || !body.name.trim())
      ) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      if (body.name !== undefined && body.name.trim().length > MAX_NAME_LENGTH) {
        return res
          .status(400)
          .json({ error: `name must not exceed ${MAX_NAME_LENGTH} characters` });
      }
      if (body.description !== undefined && body.description.length > MAX_DESCRIPTION_LENGTH) {
        return res
          .status(400)
          .json({ error: `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` });
      }
      if (body.email !== undefined && body.email.length > MAX_EMAIL_LENGTH) {
        return res
          .status(400)
          .json({ error: `email must not exceed ${MAX_EMAIL_LENGTH} characters` });
      }
      if (body.avatar !== undefined && body.avatar.length > MAX_AVATAR_LENGTH) {
        return res
          .status(400)
          .json({ error: `avatar must not exceed ${MAX_AVATAR_LENGTH} characters` });
      }
      const entitlementError = validateGroupEntitlement(body);
      if (entitlementError) {
        return res.status(400).json({ error: entitlementError });
      }

      const updateData: Partial<Pick<IGroup, 'name' | 'description' | 'email' | 'avatar'>> &
        Partial<
          Pick<
            IGroup,
            | 'accountType'
            | 'shared'
            | 'familySeats'
            | 'localPrivacyEnabled'
            | 'allowedCapabilities'
            | 'allowedModes'
          >
        > = {};
      if (body.name !== undefined) {
        updateData.name = body.name.trim();
      }
      if (body.description !== undefined) {
        updateData.description = body.description;
      }
      if (body.email !== undefined) {
        updateData.email = body.email;
      }
      if (body.avatar !== undefined) {
        updateData.avatar = body.avatar;
      }
      if (body.accountType !== undefined) {
        updateData.accountType = body.accountType;
      }
      if (body.shared !== undefined) {
        updateData.shared = body.shared;
      }
      if (body.familySeats !== undefined) {
        updateData.familySeats = body.familySeats;
      }
      if (body.localPrivacyEnabled !== undefined) {
        updateData.localPrivacyEnabled = body.localPrivacyEnabled;
      }
      if (body.allowedCapabilities !== undefined) {
        updateData.allowedCapabilities = body.allowedCapabilities;
      }
      if (body.allowedModes !== undefined) {
        updateData.allowedModes = body.allowedModes;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const group = await updateGroupById(id, updateData);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      await emitGroupAudit(req, 'group.updated', group, {
        fields: Object.keys(updateData).join(','),
      });
      return res.status(200).json({ group });
    } catch (error) {
      if ((error as ValidationError).name === 'ValidationError') {
        return res.status(400).json({ error: (error as ValidationError).message });
      }
      logger.error('[adminGroups] updateGroup error:', error);
      return res.status(500).json({ error: 'Failed to update group' });
    }
  }

  async function deleteGroupHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as GroupIdParams;
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid group ID format' });
      }
      const deleted = await deleteGroup(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Group not found' });
      }
      /**
       * deleteAclEntries is a raw deleteMany wrapper with no type casting.
       * grantPermission stores group principalId as ObjectId, so we must
       * cast here. deleteConfig normalizes internally.
       */
      const cleanupResults = await Promise.allSettled([
        deleteConfig(PrincipalType.GROUP, id),
        deleteAclEntries({
          principalType: PrincipalType.GROUP,
          principalId: new Types.ObjectId(id),
        }),
      ]);
      for (const result of cleanupResults) {
        if (result.status === 'rejected') {
          logger.error('[adminGroups] cascade cleanup step failed for group:', id, result.reason);
        }
      }
      await emitGroupAudit(req, 'group.deleted', deleted, {
        rejectedCleanup: cleanupResults.filter((r) => r.status === 'rejected').length,
      });
      return res.status(200).json({ success: true, id });
    } catch (error) {
      logger.error('[adminGroups] deleteGroup error:', error);
      return res.status(500).json({ error: 'Failed to delete group' });
    }
  }

  async function getGroupMembersHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as GroupIdParams;
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid group ID format' });
      }
      const group = await findGroupById(id, { memberIds: 1 });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      /**
       * `total` counts unique raw memberId strings. After user resolution, two
       * distinct strings may map to the same user, so `members.length` can be
       * less than the page size. Write paths prevent this for well-formed data.
       */
      const allMemberIds = [...new Set(group.memberIds || [])];
      const total = allMemberIds.length;
      const { limit, offset } = parsePagination(req.query);

      if (total === 0 || offset >= total) {
        return res.status(200).json({ members: [], total, limit, offset });
      }

      const memberIds = allMemberIds.slice(offset, offset + limit);

      const validObjectIds = memberIds.filter(isValidObjectIdString);
      const conditions: FilterQuery<IUser>[] = [{ idOnTheSource: { $in: memberIds } }];
      if (validObjectIds.length > 0) {
        conditions.push({ _id: { $in: validObjectIds } });
      }
      // seatToken is select:false in the schema — include it explicitly so the
      // seatAssigned badge can be derived for each member.
      const users = await findUsers(
        { $or: conditions },
        'name email avatar idOnTheSource accountType seatToken',
      );

      const userMap = new Map<string, IUser>();
      for (const user of users) {
        if (user.idOnTheSource) {
          userMap.set(user.idOnTheSource, user);
        }
        if (user._id) {
          userMap.set(user._id.toString(), user);
        }
      }

      const seen = new Set<string>();
      const members: {
        userId: string;
        name: string;
        email: string;
        avatarUrl?: string;
        accountType?: string | null;
        seatAssigned?: boolean;
      }[] = [];
      for (const memberId of memberIds) {
        const user = userMap.get(memberId);
        const userId = user?._id?.toString() ?? memberId;
        if (seen.has(userId)) {
          continue;
        }
        seen.add(userId);
        members.push({
          userId,
          name: user?.name ?? memberId,
          email: user?.email ?? '',
          avatarUrl: user?.avatar,
          accountType: user?.accountType ?? null,
          seatAssigned: Boolean(user?.seatToken),
        });
      }

      return res.status(200).json({ members, total, limit, offset });
    } catch (error) {
      logger.error('[adminGroups] getGroupMembers error:', error);
      return res.status(500).json({ error: 'Failed to get group members' });
    }
  }

  async function addGroupMemberHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as GroupIdParams;
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid group ID format' });
      }
      const { userId } = req.body as { userId: string };
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId is required' });
      }
      if (!isValidObjectIdString(userId)) {
        return res
          .status(400)
          .json({ error: 'Only native user ObjectIds can be added via this endpoint' });
      }

      const { group } = await addUserToGroup(userId, id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      await emitGroupAudit(req, 'group.member_added', group, { memberUserId: userId });
      return res.status(200).json({ group });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isNotFound = message === 'User not found' || message.startsWith('User not found:');
      if (isNotFound) {
        return res.status(404).json({ error: 'User not found' });
      }
      logger.error('[adminGroups] addGroupMember error:', error);
      return res.status(500).json({ error: 'Failed to add member' });
    }
  }

  /**
   * Attempt removal of an ObjectId-format member: first via removeUserFromGroup
   * (which resolves the user), falling back to a raw $pull if the user record
   * no longer exists. Returns null only when the group itself is not found.
   */
  async function removeObjectIdMember(groupId: string, userId: string): Promise<IGroup | null> {
    try {
      const { group } = await removeUserFromGroup(userId, groupId);
      return group;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'User not found' || msg.startsWith('User not found:')) {
        return removeMemberById(groupId, userId);
      }
      throw err;
    }
  }

  async function removeGroupMemberHandler(req: ServerRequest, res: Response) {
    try {
      const { id, userId } = req.params as GroupMemberParams;
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid group ID format' });
      }

      const group = isValidObjectIdString(userId)
        ? await removeObjectIdMember(id, userId)
        : await removeMemberById(id, userId);

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      await emitGroupAudit(req, 'group.member_removed', group, { memberUserId: userId });
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('[adminGroups] removeGroupMember error:', error);
      return res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  return {
    listGroups: listGroupsHandler,
    getGroup: getGroupHandler,
    createGroup: createGroupHandler,
    updateGroup: updateGroupHandler,
    deleteGroup: deleteGroupHandler,
    getGroupMembers: getGroupMembersHandler,
    addGroupMember: addGroupMemberHandler,
    removeGroupMember: removeGroupMemberHandler,
  };
}
