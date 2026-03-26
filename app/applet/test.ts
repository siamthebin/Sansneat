const auth = { currentUser: null };
try {
  const providerInfo = auth.currentUser?.providerData.map(p => p) || [];
  console.log("SUCCESS", providerInfo);
} catch (e) {
  console.log("ERROR", e.message);
}
