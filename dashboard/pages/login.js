import { useState } from 'react';
import { useRouter } from 'next/router';
import { gql, useMutation } from '@apollo/client';

const LOGIN = gql`
  mutation AdminLogin($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const [login, { error }] = useMutation(LOGIN, {
    onCompleted: (data) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.adminLogin.token);
        router.replace('/');
      }
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    login({ variables: { email, password } });
  };

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          className="w-full p-2 rounded bg-gray-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
        />
        <input
          className="w-full p-2 rounded bg-gray-700"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
        />
        <button className="px-4 py-2 bg-blue-600 rounded" type="submit">Login</button>
      </form>
      {error && <p className="text-red-500">Error logging in</p>}
    </div>
  );
}
