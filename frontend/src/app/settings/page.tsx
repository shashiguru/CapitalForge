'use client';

import { useEffect, useState } from 'react';
import { usePortfolio } from '@/contexts/portfolio-context';
import { useAuth } from '@/contexts/auth-context';
import { portfolioApi, allocationApi } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { selectedPortfolio, fetchPortfolios, refreshPortfolio } = usePortfolio();
  const { user, updateProfile } = useAuth();

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user) setDisplayName(user.name ?? '');
  }, [user]);

  const handleSaveProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword && !currentPassword) {
      toast.error('Enter your current password to change it');
      return;
    }
    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: displayName.trim() || undefined,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };
  const [yearlyBudget, setYearlyBudget] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedPortfolio) {
      setYearlyBudget(selectedPortfolio.totalCapital.toString());
      const y = new Date().getFullYear();
      setYearStart(selectedPortfolio.budgetYearStart ?? `${y}-01-01`);
      setYearEnd(selectedPortfolio.budgetYearEnd ?? `${y}-12-31`);
    }
  }, [selectedPortfolio]);

  const handleSave = async () => {
    if (!selectedPortfolio) return;

    const totalCapital = parseFloat(yearlyBudget);

    if (isNaN(totalCapital) || totalCapital < 0) {
      toast.error('Please enter a valid yearly budget');
      return;
    }

    const startDate = yearStart.trim() || undefined;
    const endDate = yearEnd.trim() || undefined;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        toast.error('Start date must be before end date');
        return;
      }
    }

    setIsSaving(true);
    try {
      await portfolioApi.update(selectedPortfolio.id, {
        totalCapital,
        budgetYearStart: startDate,
        budgetYearEnd: endDate,
      });
      await allocationApi.recalculateBuckets(selectedPortfolio.id);
      await fetchPortfolios();
      await refreshPortfolio();
      toast.success('Budget saved. Allocations and DCA amounts recalculated.');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedPortfolio) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Card className="w-96 text-center">
            <CardHeader>
              <CardTitle>No Portfolio Selected</CardTitle>
              <CardDescription>Select a portfolio to manage settings.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 w-full max-w-2xl">
        <div>
          <h1 className="text-4xl font-serif font-normal">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile and portfolio configuration</p>
        </div>

        {/* ── Profile ── */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your display name and password. Your name appears in the nav bar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ''} disabled className="bg-muted/40 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Change Password</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Leave blank to keep unchanged"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yearly Budget</CardTitle>
            <CardDescription>
              Your yearly investment budget. Allocations and DCA amounts are recalculated when you save. Strategy buy amounts scale when this differs from the reference budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yearlyBudget">Yearly Budget ($)</Label>
              <Input
                id="yearlyBudget"
                type="number"
                min={0}
                step={100}
                value={yearlyBudget}
                onChange={(e) => setYearlyBudget(e.target.value)}
                placeholder="e.g. 20000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearStart">Budget Period Start</Label>
                <Input
                  id="yearStart"
                  type="date"
                  value={yearStart}
                  onChange={(e) => setYearStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearEnd">Budget Period End</Label>
                <Input
                  id="yearEnd"
                  type="date"
                  value={yearEnd}
                  onChange={(e) => setYearEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Start and end of your budget period (e.g. Jan 1 – Dec 31 for calendar year).
            </p>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
