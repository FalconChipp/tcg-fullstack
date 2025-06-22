// "use client";
// import React, { useEffect, useState } from "react";
// import { useSearchParams } from "next/navigation";
// import { useRouter } from "next/router";

// const WP_GRAPHQL_URL = "http://tcg.local/graphql";

// export default function VerifyPage() {
//   const searchParams = useSearchParams();
//   const [status, setStatus] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   // On mount: verify token from URL
//   useEffect(() => {
//     const token = searchParams.get("token");
//     if (!token) {
//       setStatus({
//         type: "error",
//         msg: "Missing verification token. Please check your email for the correct link.",
//       });
//       setLoading(false);
//       return;
//     }

//     async function verifyEmail() {
//       setLoading(true);
//       setStatus(null);

//       const query = `
//         mutation VerifyEmail($input: VerifyEmailInput!) {
//           verifyEmail(input: $input) {
//             ok
//           }
//         }
//       `;
//       const variables = { input: { token } };

//       try {
//         const res = await fetch(WP_GRAPHQL_URL, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ query, variables }),
//         });
//         const json = await res.json();
//         const out = json?.data?.verifyEmail;
//         if (out?.ok) {
//           setStatus({
//             type: "success",
//             msg: "Email verified successfully! You may now log in.",
//           });
//         } else {
//           setStatus({
//             type: "error",
//             msg: "Verification failed. The link may have expired or already been used.",
//           });
//         }
//       } catch (err) {
//         setStatus({
//           type: "error",
//           msg: "A network error occurred. Please try again later.",
//         });
//       } finally {
//         setLoading(false);
//       }
//     }

//     verifyEmail();
//     // eslint-disable-next-line
//   }, [searchParams]);

//   useEffect(() => {
//     if (status?.type === "success") {
//       const timeout = setTimeout(() => {
//         router.push("/?verify=1");
//       }, 5000);
//       return () => clearTimeout(timeout);
//     }
//   }, [status, router]);

//   return (
//     <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-light-background dark:bg-dark-background pt-20">
//       <div className="w-full max-w-md mx-auto p-7 rounded-2xl bg-white dark:bg-[#181822] border border-light-border dark:border-dark-border shadow-xl">
//         <h1 className="text-2xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
//           Email Verification
//         </h1>
//         {loading ? (
//           <div className="text-base text-light-textMuted dark:text-dark-textMuted text-center py-6">
//             Verifying…
//           </div>
//         ) : status ? (
//           <div className="text-center">
//             <div
//               className={`
//                 px-4 py-3 rounded-lg font-medium border mb-2 text-center
//                 ${status.type === "success"
//                   ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/70 dark:text-green-100 dark:border-green-700"
//                   : "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/70 dark:text-red-100 dark:border-red-700"
//                 }
//               `}
//               role="alert"
//             >
//               {status.msg}
//             </div>
//             {status.type === "success" && (
//               <div className="mt-7">
//                 <a
//                   href="/?verify=1"
//                   className="
//                     inline-block bg-light-primary hover:bg-light-accent
//                     dark:bg-dark-primary dark:hover:bg-dark-accent
//                     text-white font-bold px-8 py-2.5 rounded-xl shadow transition
//                   "
//                 >
//                   Log In
//                 </a>
//                 <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-3">
//                   If you are not redirected automatically, click the button above.
//                 </p>
//               </div>
//             )}
//           </div>
//         ) : null}
//       </div>
//     </div>
//   );
// }


"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: verify token from URL
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus({
        type: "error",
        msg: "Missing verification token. Please check your email for the correct link.",
      });
      setLoading(false);
      return;
    }

    async function verifyEmail() {
      setLoading(true);
      setStatus(null);

      const query = `
        mutation VerifyEmail($input: VerifyEmailInput!) {
          verifyEmail(input: $input) {
            ok
          }
        }
      `;
      const variables = { input: { token } };

      try {
        const res = await fetch(WP_GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });
        const json = await res.json();
        const out = json?.data?.verifyEmail;
        if (out?.ok) {
          setStatus({
            type: "success",
            msg: "Your email has been verified! Your account is now confirmed.",
          });
        } else {
          setStatus({
            type: "error",
            msg: "Verification failed. The link may have expired or already been used.",
          });
        }
      } catch (err) {
        setStatus({
          type: "error",
          msg: "A network error occurred. Please try again later.",
        });
      } finally {
        setLoading(false);
      }
    }

    verifyEmail();
    // eslint-disable-next-line
  }, [searchParams]);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-light-background dark:bg-dark-background pt-20">
      <div className="w-full max-w-md mx-auto p-7 rounded-2xl bg-white dark:bg-[#181822] border border-light-border dark:border-dark-border shadow-xl">
        <h1 className="text-2xl font-bold mb-4 text-light-accent dark:text-dark-accent text-center">
          Email Verification
        </h1>
        {loading ? (
          <div className="text-base text-light-textMuted dark:text-dark-textMuted text-center py-6">
            Verifying…
          </div>
        ) : status ? (
          <div className="text-center">
            <div
              className={`px-4 py-3 rounded-lg font-medium border mb-2 text-center
                ${status.type === "success"
                  ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/70 dark:text-green-100 dark:border-green-700"
                  : "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/70 dark:text-red-100 dark:border-red-700"
                }`}
              role="alert"
            >
              {status.msg}
            </div>
            {status.type === "success" && (
              <div className="mt-7">
                <div className="bg-light-alt dark:bg-dark-alt rounded-xl px-4 py-4 mb-2">
                  <p className="text-base text-light-text dark:text-dark-text font-semibold">
                    Login is currently disabled until launch.
                  </p>
                  <p className="text-sm text-light-textMuted dark:text-dark-textMuted mt-2">
                    You’ll be notified as soon as the platform is live and you can log in.<br />
                    Thank you for signing up!
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
