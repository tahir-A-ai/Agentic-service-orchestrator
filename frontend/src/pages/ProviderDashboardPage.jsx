import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatsRow from '../components/provider/Dashboard/StatsRow';
import JobCard from '../components/provider/Dashboard/JobCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { getProviderJobs, toggleAvailability } from '../api/provider';
import { useToast } from '../context/ToastContext';
import styles from './ProviderDashboardPage.module.css';

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
 */
function useProviderJobs() {
  const { providerProfile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const prevPendingCountRef = useRef(null);

  const fetchJobs = useCallback(async () => {
    if (!providerProfile?.id) return;
    try {
      setLoading(true);
      const data = await getProviderJobs(providerProfile.id);
      const newJobs = data.jobs || [];
      
      const newPendingCount = newJobs.filter(j => j.status === 'Pending_Acceptance').length;
      if (prevPendingCountRef.current !== null && newPendingCount > prevPendingCountRef.current) {
        playPing();
        showToast('Naya kaam aaya hai!', 'info');
      }
      prevPendingCountRef.current = newPendingCount;

      setJobs(newJobs);
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
  const { recentJobs, activeJobs, loading, refetch } = useProviderJobs();
  
  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>Aapki activity ka overview</p>
      <StatsRow />

      <h2 className={styles.sectionTitle}>Recent Bookings</h2>
      {loading ? (
        <p>Loading...</p>
      ) : recentJobs.length > 0 ? (
        <div className={styles.jobList}>
          {recentJobs.slice(0, 5).map(job => (
            <JobCard key={job.session_id || job.id} job={job} variant="compact" onActionComplete={refetch} />
          ))}
        </div>
      ) : (
        <EmptyState title="Koi naya kaam nahi hai" />
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
      <p className={styles.subtitle}>Jobs that need your attention</p>
      
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
          title="Koi active job nahi hai" 
          subtitle="Jab naya kaam aayega toh yahan show hoga." 
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
      <h1 className={styles.title}>Job History</h1>
      <p className={styles.subtitle}>Aapke purane completed jobs</p>
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
          title="History khali hai" 
          subtitle="Aapne abhi tak koi kaam complete nahi kiya." 
        />
      )}
    </div>
  );
}

export function DeclinedJobsTab() {
  const isAuth = useRequireAuth();
  const { allJobs, loading } = useProviderJobs();
  
  if (!isAuth) return null;

  // Filter declined jobs client-side since API returns all jobs
  const declinedJobs = allJobs.filter(j => j.status === 'Declined' || j.status === 'Cancelled');

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Declined Jobs</h1>
      <p className={styles.subtitle}>Jobs that you have declined or missed</p>
      {loading ? (
        <p>Loading...</p>
      ) : declinedJobs.length > 0 ? (
        <div className={styles.jobList}>
          {declinedJobs.map(job => (
            <JobCard key={job.session_id} job={job} readOnly />
          ))}
        </div>
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

        <div className={styles.formGrid}>
          <Input label="Full Name" defaultValue={providerProfile?.name || ''} />
          <Input label="Email Address" type="email" defaultValue={providerProfile?.name || ''} />
          <Input label="Phone Number" prefix="+92" defaultValue="" />
          <Input label="Service Area" defaultValue={providerProfile?.sector || ''} />
          <div className={styles.fullWidth}>
            <Input as="textarea" label="Bio / Skills" defaultValue="" />
          </div>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => showToast('Profile updated successfully!', 'success')}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
