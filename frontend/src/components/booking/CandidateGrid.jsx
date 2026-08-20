import ProviderCard from '../chat/ProviderCard';
import styles from './CandidateGrid.module.css';

/**
 * Grid of provider candidate cards, grouped by service type.
 *
 * @param {Object} candidates — { "Electrician": [...], "Plumber": [...] }
 * @param {number[]} approvedIds
 * @param {function} onToggle — called with provider ID
 */
export default function CandidateGrid({
  candidates,
  approvedIds = [],
  excludedIds = [],
  locked = false,
  onToggle,
}) {
  const serviceTypes = Object.keys(candidates || {});
  
  if (serviceTypes.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      {serviceTypes.map((svcType) => (
        <div key={svcType} className={styles.group}>
          {serviceTypes.length > 1 && (
            <h4 className={styles.groupTitle}>{svcType} ke liye:</h4>
          )}
          <div className={styles.grid}>
            {candidates[svcType].map((provider) => {
              const isProviderExcluded = Array.isArray(excludedIds) && excludedIds.includes(provider.id);
              const isCardLocked = locked || isProviderExcluded;
              return (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  serviceType={svcType}
                  selected={approvedIds.includes(provider.id)}
                  locked={isCardLocked}
                  onToggle={onToggle}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

