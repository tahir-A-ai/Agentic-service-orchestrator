import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProviderStats } from '../context/ProviderStatsContext';
import StatsRow from '../components/provider/Dashboard/StatsRow';
import JobCard from '../components/provider/Dashboard/JobCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import { getProviderJobs, toggleAvailability, updateProviderProfile, uploadProviderPhoto } from '../api/provider';
import { useToast } from '../context/ToastContext';
import styles from './ProviderDashboardPage.module.css';

const PAGE_SIZE = 10;

function usePaginationState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const setPage = useCallback((newPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage <= 1) {
        next.delete('page');
      } else {
        next.set('page', String(newPage));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return [page, setPage];
}



const playPing = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

/**
 * Custom hook to fetch dynamic provider jobs.
 * Accepts an optional externalRefetchKey: when it changes, triggers a refetch.
 */
function useProviderJobs(externalRefetchKey = 0) {
  const { providerProfile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const prevPendingCountRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchJobs = useCallback(async () => {
    if (!providerProfile?.id) {
      setJobs([]);
      setLoading(false);
      return;
    }
    const currentRequestId = ++requestIdRef.current;

    try {
      setLoading(true);
      const data = await getProviderJobs(providerProfile.id);
      
      // If a newer request was dispatched before this one resolved, ignore stale result
      if (currentRequestId !== requestIdRef.current) return;

      const newJobs = data.jobs || [];
      
      const newPendingCount = newJobs.filter(j => j.status === 'Pending_Acceptance').length;
      if (prevPendingCountRef.current !== null && newPendingCount > prevPendingCountRef.current) {
        playPing();
        showToast('Naya kaam aaya hai!', 'info');
      }
      prevPendingCountRef.current = newPendingCount;

      setJobs(newJobs);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      if (err.status === 401 || (err.message && err.message.toLowerCase().includes('login'))) {
        return; // Ignore auth errors during logout transition
      }
      showToast('Jobs fetch karne mein error: ' + err.message, 'error');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [providerProfile?.id, showToast]);


  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, externalRefetchKey]);

  return {
    allJobs: jobs,
    recentJobs: jobs.filter(j => j.status !== 'Pending_Acceptance'),
    activeJobs: jobs.filter(j => j.status === 'Pending_Acceptance' || j.status === 'In_Progress' || j.status === 'Pending_Completion'),
    completedJobs: jobs.filter(j => j.status === 'Completed'),
    loading,
    refetch: fetchJobs
  };
}

/**
 * Protected wrapper for dashboard components.
 */
function useRequireAuth() {
  const { providerLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!providerLoggedIn) {
      navigate('/provider/register');
    }
  }, [providerLoggedIn, navigate]);

  return providerLoggedIn;
}

export function OverviewTab() {
  const isAuth = useRequireAuth();
  const { jobsRefetchKey } = useProviderStats();
  const { recentJobs, loading, refetch } = useProviderJobs(jobsRefetchKey);
  const [page, setPage] = usePaginationState();

  if (!isAuth) return null;

  const totalPages = Math.ceil(recentJobs.length / PAGE_SIZE);
  const validPage = Math.min(page, Math.max(1, totalPages));
  const paginatedJobs = recentJobs.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>Aapki activity ka overview</p>
      <StatsRow />

      <h2 className={styles.sectionTitle}>Recent Bookings</h2>
      {loading ? (
        <p>Loading...</p>
      ) : recentJobs.length > 0 ? (
        <>
          <div className={styles.jobList}>
            {paginatedJobs.map((job) => (
              <JobCard
                key={job.session_id || job.id}
                job={job}
                variant="compact"
                onActionComplete={refetch}
              />
            ))}
          </div>
          <Pagination
            currentPage={validPage}
            totalItems={recentJobs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState title="Koi naya kaam nahi hai" />
      )}
    </div>
  );
}

export function ActiveJobsTab() {
  const isAuth = useRequireAuth();
  const { jobsRefetchKey } = useProviderStats();
  const { activeJobs, loading, refetch } = useProviderJobs(jobsRefetchKey);
  const [page, setPage] = usePaginationState();

  if (!isAuth) return null;

  const totalPages = Math.ceil(activeJobs.length / PAGE_SIZE);
  const validPage = Math.min(page, Math.max(1, totalPages));
  const paginatedJobs = activeJobs.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Active Jobs</h1>
      <p className={styles.subtitle}>Jobs that need your attention</p>

      {loading ? (
        <p>Loading...</p>
      ) : activeJobs.length > 0 ? (
        <>
          <div className={styles.jobList}>
            {paginatedJobs.map((job) => (
              <JobCard key={job.session_id} job={job} onActionComplete={refetch} />
            ))}
          </div>
          <Pagination
            currentPage={validPage}
            totalItems={activeJobs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="Koi active job nahi hai"
          subtitle="Jab naya kaam aayega toh yahan show hoga."
        />
      )}
    </div>
  );
}

export function CompletedJobsTab() {
  const isAuth = useRequireAuth();
  const { jobsRefetchKey } = useProviderStats();
  const { completedJobs, loading } = useProviderJobs(jobsRefetchKey);
  const [page, setPage] = usePaginationState();

  if (!isAuth) return null;

  const totalPages = Math.ceil(completedJobs.length / PAGE_SIZE);
  const validPage = Math.min(page, Math.max(1, totalPages));
  const paginatedJobs = completedJobs.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Job History</h1>
      <p className={styles.subtitle}>Aapke purane completed jobs</p>
      {loading ? (
        <p>Loading...</p>
      ) : completedJobs.length > 0 ? (
        <>
          <div className={styles.jobList}>
            {paginatedJobs.map((job) => (
              <JobCard key={job.session_id} job={job} readOnly />
            ))}
          </div>
          <Pagination
            currentPage={validPage}
            totalItems={completedJobs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="History khali hai"
          subtitle="Aapne abhi tak koi kaam complete nahi kiya."
        />
      )}
    </div>
  );
}

export function DeclinedJobsTab() {
  const isAuth = useRequireAuth();
  const { jobsRefetchKey } = useProviderStats();
  const { allJobs, loading } = useProviderJobs(jobsRefetchKey);
  const [page, setPage] = usePaginationState();

  if (!isAuth) return null;

  // Filter declined jobs client-side since API returns all jobs
  const declinedJobs = allJobs.filter((j) => j.status === 'Declined' || j.status === 'Cancelled');
  const totalPages = Math.ceil(declinedJobs.length / PAGE_SIZE);
  const validPage = Math.min(page, Math.max(1, totalPages));
  const paginatedJobs = declinedJobs.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Declined Jobs</h1>
      <p className={styles.subtitle}>Jobs that you have declined or missed</p>
      {loading ? (
        <p>Loading...</p>
      ) : declinedJobs.length > 0 ? (
        <>
          <div className={styles.jobList}>
            {paginatedJobs.map((job) => (
              <JobCard key={job.session_id} job={job} readOnly />
            ))}
          </div>
          <Pagination
            currentPage={validPage}
            totalItems={declinedJobs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="Koi declined job nahi hai"
          subtitle="Aapne koi job decline nahi ki."
        />
      )}
    </div>
  );
}



export function ProfileTab() {
  const { providerProfile, updateUser } = useAuth();
  const isAuth = useRequireAuth();
  const { showToast } = useToast();
  
  // Profile state
  const [profileData, setProfileData] = useState({
    full_name: providerProfile?.name || '',
    email: providerProfile?.email || '',
    phone: providerProfile?.phone || '',
    location: providerProfile?.sector || '',
    bio: providerProfile?.bio || '',
    photo_url: providerProfile?.photo_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setImageError(false);
  }, [profileData.photo_url]);

  if (!isAuth) return null;

  
  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProviderProfile(providerProfile.id, profileData);
      
      // Update local AuthContext so it persists on reload
      updateUser({
        full_name: profileData.full_name,
        email: profileData.email,
        phone: profileData.phone,
        location: profileData.location,
        bio: profileData.bio,
        photo_url: profileData.photo_url
      });
      
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const res = await uploadProviderPhoto(providerProfile.id, file);
      
      // Update local state and context immediately
      setProfileData(prev => ({ ...prev, photo_url: res.photo_url }));
      updateUser({ photo_url: res.photo_url });
      
      showToast('Photo uploaded successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChange = (field) => (e) => {
    setProfileData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Profile Settings</h1>
      
      <div className={styles.profileForm}>
        <div className={styles.photoUpload}>
          <div className={styles.photoCircle}>
            {profileData.photo_url && !imageError ? (
              <img 
                src={profileData.photo_url} 
                alt="Profile" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                onError={() => setImageError(true)}
              />
            ) : (
              profileData.full_name?.charAt(0)?.toUpperCase() || 'P'
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : '+ Upload Photo'}
          </Button>
        </div>

        <div className={styles.formGrid}>
          <Input label="Full Name" value={profileData.full_name} onChange={handleChange('full_name')} />
          <Input label="Email Address" type="email" value={profileData.email} onChange={handleChange('email')} />
          <Input label="Phone Number" prefix="+92" value={profileData.phone} onChange={handleChange('phone')} />
          <Input label="Service Area" value={profileData.location} onChange={handleChange('location')} />
          <div className={styles.fullWidth}>
            <Input as="textarea" label="Bio / Skills" value={profileData.bio} onChange={handleChange('bio')} />
          </div>
        </div>

        <div className={styles.actions}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
