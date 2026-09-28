import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Shield, UserPlus, CheckCircle2 } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { authService, UserProfile } from '../services/authService';
import { UserRoleCode } from '../types';
import { getUsersStore } from '../mock/store';
import { useToast } from '../components/common/Toast';

export const Users: React.FC = () => {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('TESTING_OFFICER');
  const [loading, setLoading] = useState(true);

  const ALLOWED_ROLES: UserRoleCode[] = [
    'ADMIN',
    'TESTING_OFFICER',
    'TECHNICAL_REVIEWER',
    'LAB_DIRECTOR',
    'AUDITOR',
  ];

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentUser();
      if (user) setCurrentUserRole(user.role);

      if (isSupabaseConfigured()) {
        const data = await authService.getAllProfiles();
        setProfiles(data);
      } else {
        const mockData = getUsersStore().map((u) => ({
          id: u.id,
          fullName: u.name,
          name: u.name,
          email: u.email,
          role: u.role as UserRoleCode,
          organization: u.department,
        }));
        setProfiles(mockData);
      }
    } catch (err: any) {
      console.warn('Error loading profiles:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRoleCode) => {
    try {
      await authService.updateUserRole(userId, newRole);
      showToast('Role Updated', `User role successfully updated to ${newRole}.`, 'success');
      loadProfiles();
    } catch (err: any) {
      showToast('Update Failed', err.message || 'Failed to update user role.', 'error');
    }
  };

  const isAdmin = currentUserRole === 'ADMIN';

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">Users & Role Access Control</h2>
          <p className="text-xs text-[#5F6B7A] mt-1">
            Manage laboratory personnel, auditor privileges, and digital signature authorizations.
          </p>
        </div>

        {isAdmin && (
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded-lg transition-colors border border-[#C8A46B]/40 shadow-xs cursor-pointer">
            <UserPlus className="w-4 h-4 text-[#C8A46B]" /> Add Officer Account
          </button>
        )}
      </div>

      {/* Users Directory Table */}
      <div className="bg-white rounded-xl border border-[#D9D3C7] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#D9D3C7] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0B1F3A]">Authorized Laboratory Staff</h3>
          <span className="text-xs font-bold text-[#C8A46B] bg-[#F4ECDD] px-2.5 py-1 rounded-full border border-[#C8A46B]/30">
            {profiles.length} Active Personnel
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1F3A] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D3C7] text-xs text-[#1A1F2B]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#5F6B7A]">
                    Loading personnel records...
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#5F6B7A]">
                    No users found.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F4ECDD]/30 transition-colors">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0B1F3A] text-[#C8A46B] font-bold text-xs flex items-center justify-center shrink-0 border border-[#C8A46B]/40">
                        {(p.fullName || 'User').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-[#0B1F3A] block">{p.fullName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{p.id}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#0B1F3A]">
                      {isAdmin ? (
                        <select
                          value={p.role}
                          onChange={(e) => handleRoleChange(p.id, e.target.value as UserRoleCode)}
                          className="px-2.5 py-1 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#0B1F3A] font-bold focus:outline-hidden focus:border-[#C8A46B] cursor-pointer"
                        >
                          {ALLOWED_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2.5 py-1 bg-[#F4ECDD] text-[#0B1F3A] rounded font-bold text-[11px] border border-[#C8A46B]/40">
                          {p.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#5F6B7A]">{p.organization || 'National Legal Metrology Laboratory'}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
