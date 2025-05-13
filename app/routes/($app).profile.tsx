import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { requireUser } from "~/app/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  return json({ user });
}

export default function ProfilePage() {
  const loaderData = useLoaderData<typeof loader>();
  const user = loaderData.user;

  return (
    <div className="flex h-full min-h-screen flex-col">
      <main className="flex h-full bg-white">
        <div className="flex-1 p-6">
          <h2 className="text-2xl font-semibold">Profile</h2>
          <hr className="my-4" />

          <div className="space-y-2">
            <p>
              <strong>ID:</strong> {user.id}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
          </div>

          <hr className="my-6" />

          <div>
            <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>
                Deleting your account is a permanent action and cannot be undone.
                All your data will be removed.
              </p>
            </div>
            <div className="mt-4">
              <Form method="post" action="delete-user">
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Delete Account
                </button>
              </Form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 