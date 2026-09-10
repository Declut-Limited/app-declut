import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PermissionModal, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { getProfileImage } from '@/utils/helpers';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useAuth } from '@/contexts/AuthContext';
import { mediaApi, usersApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

export default function AccountDetailsModal() {
  const { user, refreshUser } = useAuth();
  const guard = useSingleTap();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [nameFocused, setNameFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [permissionPrompt, setPermissionPrompt] = useState<{ target: string; message: string } | null>(null);

  const displayAvatar = avatarPreviewUri ?? user?.profileImageUrl;

  async function ensureLibraryAccess(): Promise<boolean> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (permission.canAskAgain) {
        showErrorToast('Permission needed', 'Allow photo library access to update your profile photo.');
      } else {
        setPermissionPrompt({
          target: 'your gallery',
          message: 'Photo library access is turned off. Enable it in Settings to update your profile photo.',
        });
      }
      return false;
    }
    return true;
  }

  async function uploadAvatar(uri: string) {
    setAvatarPreviewUri(uri);
    setAvatarUploading(true);
    try {
      const signature = await mediaApi.getUploadSignature();
      const uploaded = await mediaApi.uploadToCloudinary(uri, signature, 'image');
      await usersApi.updateMyProfile({ profileImage: uploaded.secureUrl });
      await refreshUser();
    } catch (e) {
      showErrorToast('Could not update photo', extractErrorMessage(e));
      setAvatarPreviewUri(null);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function pickAvatarFromLibrary() {
    if (!(await ensureLibraryAccess())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets[0]) return;
      uploadAvatar(result.assets[0].uri);
    } catch {
      showErrorToast('Something went wrong', 'That photo could not be added — try again.');
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await usersApi.updateMyProfile({ name: trimmed });
      await refreshUser();
      setEditing(false);
      showSuccessToast('Saved', 'Your account details have been updated.');
    } catch (e) {
      showErrorToast('Could not save changes', extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleEdit() {
    if (editing) setName(user?.name ?? '');
    setEditing((v) => !v);
  }

  return (
    <View style={styles.flex}>
      <ScreenContainer
        edges={['top', 'bottom']}
        background={colors.white}
        header={
          <ScreenHeader
            title="Account Details"
            rightElement={
              <Pressable onPress={guard(toggleEdit)} hitSlop={8}>
                <Text style={styles.editText}>{editing ? 'Cancel' : 'Edit'}</Text>
              </Pressable>
            }
          />
        }
        footer={
          editing ? (
            <View>
              <Pressable
                onPress={guard(handleSave)}
                disabled={saving || !name.trim()}
                style={[styles.saveButton, (saving || !name.trim()) && styles.saveButtonDisabled]}
              >
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonLabel}>Save Changes</Text>}
              </Pressable>
              <Text style={styles.saveFootnote}>Changing your phone number will require OTP re-verification.</Text>
            </View>
          ) : null
        }
      >
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            <Image source={getProfileImage(displayAvatar)} style={styles.avatar} />
            {avatarUploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
            <Pressable onPress={guard(pickAvatarFromLibrary)} style={styles.avatarBadge} hitSlop={8}>
              <Icon name="camera" variant="bold" size={verticalScale(16)} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.fieldBox, editing && styles.fieldBoxEditable, editing && nameFocused && styles.fieldBoxFocused]}>
          <Text style={styles.fieldLabel}>Full name</Text>
          {editing ? (
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.gray400}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              autoFocus
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.name ?? '—'}</Text>
          )}
        </View>

        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Phone number</Text>
          <Text style={styles.fieldValue}>{user?.phone ?? '—'}</Text>
        </View>

        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <Text style={styles.fieldValue}>{user?.email ?? '—'}</Text>
        </View>

        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Location</Text>
          <Text style={styles.fieldValue}>{user?.location ?? '—'}</Text>
        </View>
      </ScreenContainer>

      {permissionPrompt ? (
        <View style={StyleSheet.absoluteFill}>
          <PermissionModal
            target={permissionPrompt.target}
            message={permissionPrompt.message}
            onAllow={() => {
              setPermissionPrompt(null);
              Linking.openSettings();
            }}
            onDismiss={() => setPermissionPrompt(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const AVATAR_SIZE = verticalScale(96);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  editText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    minWidth: verticalScale(55),
    alignSelf: "center",
    color: colors.primary,
  },
  avatarBlock: {
    alignItems: 'center',
    marginTop: spacingY.lg,
    marginBottom: spacingY.xl,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldBox: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray50,
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.md,
    marginBottom: spacingY.md,
  },
  fieldBoxEditable: {
    backgroundColor: colors.white,
    borderColor: colors.gray200,
  },
  fieldBoxFocused: {
    borderColor: colors.primary,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginBottom: verticalScale(2),
  },
  fieldValue: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  fieldInput: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
    padding: 0,
  },
  saveButton: {
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacingX.lg,
    marginBottom: spacingY.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  saveButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  saveFootnote: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
});
