export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        @media (max-width: 640px) {
          .admin-route,
          .admin-route * {
            box-sizing: border-box;
          }

          .admin-route {
            max-width: 100vw;
            overflow-x: hidden;
          }

          .admin-route main {
            width: 100%;
            max-width: 100vw;
            overflow-x: hidden;
            gap: 0.85rem !important;
            padding: 0.85rem 0.75rem 1.25rem !important;
          }

          .admin-route header,
          .admin-route section {
            width: 100%;
            max-width: 100%;
            overflow: hidden;
          }

          .admin-route header {
            padding: 1rem !important;
            border-radius: 1.35rem !important;
          }

          .admin-route header h1 {
            font-size: 1.8rem !important;
            line-height: 2rem !important;
          }

          .admin-route header button {
            min-height: 2.55rem;
            padding: 0.65rem 0.9rem !important;
          }

          .admin-route main > section {
            padding: 1rem !important;
            border-radius: 1.35rem !important;
          }

          .admin-route main > section:nth-of-type(2) {
            padding: 0.75rem !important;
            border-radius: 1.15rem !important;
          }

          .admin-route main > section:nth-of-type(2) h2 {
            font-size: 0.95rem !important;
            line-height: 1.25rem !important;
          }

          .admin-route main > section:nth-of-type(2) > div {
            margin-top: 0.65rem !important;
            display: grid !important;
            gap: 0.55rem !important;
            width: 100%;
            max-width: 100%;
            overflow: hidden;
          }

          .admin-route main > section:nth-of-type(2) > div > div {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            overflow: hidden;
            padding: 0.65rem !important;
            border-radius: 0.9rem !important;
          }

          .admin-route main > section:nth-of-type(2) > div > div > div,
          .admin-route main > section:nth-of-type(2) > div > div > div > div {
            width: 100%;
            max-width: 100%;
            min-width: 0 !important;
            overflow: hidden;
          }

          .admin-route main > section:nth-of-type(2) strong,
          .admin-route main > section:nth-of-type(2) div {
            max-width: 100%;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .admin-route main > section:nth-of-type(2) strong {
            font-size: 0.78rem !important;
            line-height: 1.05rem !important;
          }

          .admin-route main > section:nth-of-type(2) div {
            font-size: 0.68rem !important;
            line-height: 1.08rem !important;
          }

          .admin-route main > section:nth-of-type(2) button {
            width: 100%;
            min-height: 2rem;
            padding: 0.42rem 0.7rem !important;
            border-radius: 0.8rem !important;
            font-size: 0.62rem !important;
          }
        }
      `}</style>
    </>
  );
}
