import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatsRow from '../components/provider/Dashboard/StatsRow';
import JobCard from '../components/provider/Dashboard/JobCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { mockActiveJobs, mockCompletedJobs, mockProviderProfile } from '../data/mockData';
import styles from './ProviderDashboardPage.module.css';

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
  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Dashboard Overview</h1>
      <StatsRow />

      <h2 className={styles.sectionTitle}>Recent Bookings</h2>
      {mockActiveJobs.length > 0 ? (
        <div className={styles.jobList}>
          {mockActiveJobs.slice(0, 2).map(job => (
            <JobCard key={job.id} job={job} />
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
  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Active Jobs</h1>
      {mockActiveJobs.length > 0 ? (
        <div className={styles.jobList}>
          {mockActiveJobs.map(job => (
            <JobCard key={job.id} job={job} />
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
  if (!isAuth) return null;

  return (
    <div className={styles.tab}>
      <h1 className={styles.title}>Completed Jobs</h1>
      {mockCompletedJobs.length > 0 ? (
        <div className={styles.jobList}>
          {mockCompletedJobs.map(job => (
            <JobCard key={job.id} job={job} readOnly />
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
  if (!isAuth) return null;

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
          <Input label="Full Name" defaultValue={mockProviderProfile.name} />
          <Input label="Email Address" type="email" defaultValue={mockProviderProfile.email} />
          <Input label="Phone Number" prefix="+92" defaultValue={mockProviderProfile.phone} />
          <Input label="Service Area" defaultValue={mockProviderProfile.sector} disabled />
          <div className={styles.fullWidth}>
            <Input as="textarea" label="Bio / Skills" defaultValue={mockProviderProfile.bio} />
          </div>
        </div>

        <div className={styles.actions}>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
