"use client";

import React, { useState, useEffect } from "react";
import {
  UserPlus,
  KeyRound,
  Trash2,
  Shield,
  Palette,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/admin/shared/ui/Button";
import { Modal } from "@/admin/shared/ui/Modal";
import { formatDate } from "@/admin/shared/lib/formatters";

interface StaffAccount {
  id: string;
  email: string;
  name: string;
  role: "admin" | "designer";
  isAdmin: boolean;
  createdAt: string;
  status: string;
}

export const StaffAccountsView: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<"admin" | "designer">("designer");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Change Password Modal State
  const [targetAccount, setTargetAccount] = useState<StaffAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<StaffAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load staff accounts");
      setStaffList(data.staff || []);
    } catch (err: any) {
      setError(err.message || "Failed to load staff accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: createRole,
          name: createName.trim(),
          email: createEmail.trim(),
          password: createPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");

      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      fetchStaff();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create account");
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccount) return;
    setPwdError(null);
    setPwdSuccess(null);
    setPwdLoading(true);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetAccount.id,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      setPwdSuccess("Password updated successfully without OTP.");
      setTimeout(() => {
        setTargetAccount(null);
        setNewPassword("");
        setPwdSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPwdError(err.message || "Failed to update password");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/staff?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");

      setDeleteTarget(null);
      fetchStaff();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 w-full pb-16 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h2 className="font-headline text-xl font-bold tracking-tight text-[var(--foreground)]">
            Account Creation & Staff Roles
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Create and manage verified credentials for Administrators and Card Designers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchStaff} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin mr-1.5" : "mr-1.5"} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <UserPlus size={14} className="mr-1.5" />
            Create Account
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Accounts Table */}
      <div className="overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card)] shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] bg-[var(--accent)]/50 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th scope="col" className="px-5 py-3">Staff Member</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Created Date</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                    <Loader2 size={18} className="animate-spin inline-block mr-2" />
                    Loading staff credentials...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                    No staff accounts configured. Click <strong>Create Account</strong> to add your first administrator or designer.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/50">
                    {/* Identity */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]">
                          {staff.role === "designer" ? <Palette size={16} /> : <Shield size={16} />}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-[var(--foreground)] block">
                            {staff.name}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                            {staff.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono text-[10px] font-semibold uppercase tracking-wider border ${
                          staff.role === "admin"
                            ? "bg-[var(--accent)] text-[var(--foreground)] border-[var(--border)]"
                            : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)]"
                        }`}
                      >
                        {staff.role === "designer" ? <Palette size={11} /> : <Shield size={11} />}
                        <span>{staff.role}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--foreground)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Verified
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                      {formatDate(staff.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setTargetAccount(staff);
                            setNewPassword("");
                            setPwdError(null);
                            setPwdSuccess(null);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[11px] font-medium text-[var(--foreground)] transition-colors cursor-pointer"
                          title="Change password without OTP"
                        >
                          <KeyRound size={12} />
                          <span>Change Password</span>
                        </button>

                        <button
                          onClick={() => setDeleteTarget(staff)}
                          className="inline-flex items-center justify-center h-6.5 w-6.5 rounded-[4px] border border-[var(--border)] bg-[var(--card)] hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer"
                          title="Delete staff account"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Create Account */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Staff Account"
          maxWidth="sm"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-1">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Create pre-verified credentials for administrators or card designers. No OTP is required.
            </p>

            {createError && (
              <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* Role Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Account Role:
              </label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as "admin" | "designer")}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] cursor-pointer"
              >
                <option value="designer">Designer (Orders & Design Assets Only)</option>
                <option value="admin">Admin (Full Platform Control & Staff Management)</option>
              </select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Full Name / Label:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Designer"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)]"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Email Address:
              </label>
              <input
                type="email"
                required
                placeholder="designer@nammainfo.in"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] font-mono"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Password (min 6 characters):
              </label>
              <div className="relative">
                <input
                  type={showCreatePwd ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] pl-3 pr-9 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePwd(!showCreatePwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {showCreatePwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsCreateOpen(false)}
                disabled={createLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={createLoading}>
                <Check size={13} className="mr-1" />
                Create Staff Account
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Modal: Change Password */}
      {targetAccount && (
        <Modal
          isOpen={Boolean(targetAccount)}
          onClose={() => setTargetAccount(null)}
          title={`Change Password: ${targetAccount.name}`}
          maxWidth="sm"
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-1">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Set a new password for <strong className="text-[var(--foreground)]">{targetAccount.email}</strong>.
              This changes their credentials immediately without needing an OTP or confirmation email.
            </p>

            {pwdError && (
              <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-rose-500/20 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                <Check size={14} className="shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                New Password (min 6 characters):
              </label>
              <div className="relative">
                <input
                  type={showNewPwd ? "text" : "password"}
                  required
                  autoFocus
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--background)] pl-3 pr-9 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--foreground)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setTargetAccount(null)}
                disabled={pwdLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={pwdLoading}>
                <Check size={13} className="mr-1" />
                Update Password
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Modal: Delete Account */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="Delete Staff Account"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to delete the {deleteTarget.role} account for{" "}
              <strong className="text-[var(--foreground)]">{deleteTarget.email}</strong>?
              This will revoke all console access immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                isLoading={deleteLoading}
              >
                <Trash2 size={13} className="mr-1" />
                Confirm Deletion
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

