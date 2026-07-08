import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatsRow from '../components/provider/Dashboard/StatsRow';
import JobCard from '../components/provider/Dashboard/JobCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { getProviderJobs, toggleAvailability } from '../api/client';
import { useToast } from '../context/ToastContext';
import styles from './ProviderDashboardPage.module.css';

/**
 * Custom hook to fetch dynamic provider jobs.
 */
function useProviderJobs() {
  const { providerProfile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchJobs = useCallback(async () => {
    if (!providerProfile?.id) return;
    try {
      setLoading(true);
      const data = await getProviderJobs(providerProfile.id);
      setJobs(data.jobs || []);
    } catch (err) {
      showToast('Jobs fetch karne mein error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [providerProfile, showToast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    activeJobs: jobs.filter(j => j.status === 'Pending_Acceptance' || j.status === 'In_Progress'),
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
  const { activeJobs, loading, refetch } = useProviderJobs();
  
  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>Aapki activity ka overview</p>
      <StatsRow />

      <h2 className={styles.sectionTitle}>Recent Bookings</h2>
      {loading ? (
        <p>Loading...</p>
      ) : activeJobs.length > 0 ? (
        <div className={styles.jobList}>
          {activeJobs.slice(0, 2).map(job => (
            <JobCard key={job.session_id} job={job} variant="compact" onActionComplete={refetch} />
          ))}
        </div>
      ) : (
        <EmptyState icon="👋" title="Koi naya kaam nahi hai" />
      )}
    </div>
  );
}

export function ActiveJobsTab() {
  const isAuth = useRequireAuth();
  const { activeJobs, loading, refetch } = useProviderJobs();

  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Active Jobs</h1>
      <p className={styles.subtitle}>{activeJobs.length} kaam chal raha hai</p>
      
      {loading ? (
        <p>Loading...</p>
      ) : activeJobs.length > 0 ? (
        <div className={styles.jobList}>
          {activeJobs.map(job => (
            <JobCard key={job.session_id} job={job} onActionComplete={refetch} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="☕"
          title="Sab kaam mukammal hain"
          subtitle="Apna status 'Available' rakhein taake naye bookings mil sakein."
        />
      )}
    </div>
  );
}

export function CompletedJobsTab() {
  const isAuth = useRequireAuth();
  const { completedJobs, loading } = useProviderJobs();

  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Completed Jobs</h1>
      {loading ? (
        <p>Loading...</p>
      ) : completedJobs.length > 0 ? (
        <div className={styles.jobList}>
          {completedJobs.map(job => (
            <JobCard key={job.session_id} job={job} readOnly />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📋"
          title="Koi history nahi"
          subtitle="Aapke mukammal shuda kaam yahan show honge."
        />
      )}
    </div>
  );
}

export function ProfileTab() {
  const { providerProfile } = useAuth();
  const isAuth = useRequireAuth();
  const [isAvailable, setIsAvailable] = useState(true);
  const { showToast } = useToast();

  if (!isAuth) return null;

  const handleToggle = async () => {
    try {
      const newStatus = !isAvailable;
      setIsAvailable(newStatus);
      await toggleAvailability(providerProfile.id, newStatus);
      showToast(`Status updated to ${newStatus ? 'Available' : 'Offline'}`, 'success');
    } catch (err) {
      setIsAvailable(!isAvailable); // revert
      showToast('Failed to update status', 'error');
    }
  };

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Profile Settings</h1>
      
      <div className={styles.profileForm}>
        <div className={styles.photoUpload}>
          <div className={styles.photoCircle}>
            {providerProfile?.name?.charAt(0) || 'P'}
          </div>
          <Button variant="ghost" size="sm">+ Upload Photo</Button>
        </div>

        <div className={styles.availabilityToggle}>
          <label className={styles.toggleLabel}>
            <input type="checkbox" checked={isAvailable} onChange={handleToggle} />
            <span className={styles.toggleText}>Currently {isAvailable ? 'Available' : 'Offline'}</span>
          </label>
        </div>

        <div className={styles.formGrid}>
          <Input label="Full Name" defaultValue={providerProfile?.name || ''} />
          <Input label="Email Address" type="email" defaultValue="" />
          <Input label="Phone Number" prefix="+92" defaultValue="" />
          <Input label="Service Area" defaultValue={providerProfile?.sector || ''} disabled />
          <div className={styles.fullWidth}>
            <Input as="textarea" label="Bio / Skills" defaultValue="" />
          </div>
        </div>

        <div className={styles.actions}>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
