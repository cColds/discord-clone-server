export async function updateOnlineStatus(userId: string, isOnline: boolean) {
  try {
    const res = await fetch(`${process.env.URL}/api/updateOnlineStatus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, isOnline }),
    });

    const updatedUser = await res.json();

    return updatedUser;
  } catch (err) {
    console.error("Failed to update online status", err);
  }
}
