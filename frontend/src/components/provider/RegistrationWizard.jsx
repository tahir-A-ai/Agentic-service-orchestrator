import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMultiStep from '../../hooks/useMultiStep';
import { useAuth } from '../../context/AuthContext';
import { islamabadSectors } from '../../data/mockData';
import StepIndicator from './StepIndicator';
import ServiceTypeSelector from './ServiceTypeSelector';
import Input from '../ui/Input';
import Button from '../ui/Button';
import styles from './RegistrationWizard.module.css';

const STEPS = ['Personal Info', 'Service Details', 'Review'];

export default function RegistrationWizard() {
  const { step, next, back } = useMultiStep(STEPS.length);
  const { signup, login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    cnic: '',
    serviceType: '',
    sector: '',
    experience: '',
    bio: '',
    terms: false,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateStep1 = () => {
    const errs = {};
    if (!formData.name) errs.name = 'Naam likhna zaroori hai';
    if (!formData.email) errs.email = 'Email zaroori hai';
    if (!formData.password || formData.password.length < 6) errs.password = 'Password kam az kam 6 characters';
    if (!formData.phone || formData.phone.length !== 10) errs.phone = '10 digits ka number likhein';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!formData.serviceType) errs.serviceType = 'Service select karein';
    if (!formData.sector) errs.sector = 'Sector select karein';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && validateStep1()) next();
    if (step === 1 && validateStep2()) next();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.terms) {
      setErrors({ terms: 'Terms se agree karna zaroori hai' });
      return;
    }
    
    try {
      await signup({
        username: formData.email,
        email: formData.email,
        password: formData.password,
        role: 'provider',
        name: formData.name,
        service_type: formData.serviceType,
        location: formData.sector,
        latitude: 33.6844, // Mock coordinate for demo
        longitude: 73.0479, // Mock coordinate for demo
      });
      await login(formData.email, formData.password);
      navigate('/provider/dashboard');
    } catch (err) {
      setErrors({ form: err?.body?.detail?.message || err.message || 'Registration failed.' });
    }
  };

  return (
    <div className={styles.wizard}>
      <StepIndicator currentStep={step} steps={STEPS} />

      <form onSubmit={handleSubmit}>
        {errors.form && <div className={styles.formError}>{errors.form}</div>}
        
        {/* STEP 1 */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Personal Information</h2>
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={errors.name}
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
            />
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
            />
            <Input
              label="Phone Number"
              prefix="+92"
              type="tel"
              maxLength={10}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
              error={errors.phone}
            />
            <Input
              label="CNIC (Optional)"
              value={formData.cnic}
              onChange={(e) => handleChange('cnic', e.target.value)}
            />
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Service Details</h2>
            
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Aap kya kaam karte hain?</label>
              <ServiceTypeSelector
                value={formData.serviceType}
                onChange={(val) => handleChange('serviceType', val)}
              />
              {errors.serviceType && <span className={styles.error}>{errors.serviceType}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Primary Sector (Islamabad)</label>
              <select
                className={styles.select}
                value={formData.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
              >
                <option value="">Select sector...</option>
                {islamabadSectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.sector && <span className={styles.error}>{errors.sector}</span>}
            </div>

            <Input
              label="Years of Experience"
              type="number"
              min="0"
              value={formData.experience}
              onChange={(e) => handleChange('experience', e.target.value)}
            />

            <Input
              as="textarea"
              label="Brief Bio / Skills (Roman Urdu mein)"
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
            />
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Review Details</h2>
            
            <div className={styles.summaryCard}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Name</span>
                <span className={styles.summaryValue}>{formData.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Phone</span>
                <span className={styles.summaryValue}>+92 {formData.phone}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Service</span>
                <span className={styles.summaryValue}>{formData.serviceType}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Area</span>
                <span className={styles.summaryValue}>{formData.sector}</span>
              </div>
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.terms}
                onChange={(e) => handleChange('terms', e.target.checked)}
              />
              Main agree karta hoon terms and conditions se
            </label>
            {errors.terms && <span className={styles.error}>{errors.terms}</span>}
          </div>
        )}

        {/* Navigation Actions */}
        <div className={styles.actions}>
          {step > 0 ? (
            <Button variant="ghost" onClick={back} type="button">Back</Button>
          ) : (
            <div /> /* Empty spacer */
          )}
          
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} type="button">Next Step</Button>
          ) : (
            <Button type="submit">Submit Registration</Button>
          )}
        </div>
      </form>
    </div>
  );
}
