'use client';
import { useState } from 'react';

// Minimal example illustrating the submission guard pattern
const CREATE_BINDER = `
  mutation CreateBinder($name: String!) {
    createBinder(input: { name: $name }) { id }
  }
`;

export default function BinderCreateWithGuard() {
  const [binderName, setBinderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // guard state

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // prevent duplicate requests
    setIsSubmitting(true);
    try {
      await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CREATE_BINDER,
          variables: { name: binderName },
        }),
      });
      setBinderName('');
    } finally {
      setIsSubmitting(false); // re-enable after request
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={binderName}
        onChange={(e) => setBinderName(e.target.value)}
        disabled={isSubmitting}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Binder'}
      </button>
    </form>
  );
}
