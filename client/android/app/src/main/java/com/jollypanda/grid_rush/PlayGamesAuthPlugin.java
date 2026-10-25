package com.jollypanda.grid_rush;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;

/**
 * Google Play Games sign-in for linking the guest account.
 * serverAuthCode({ clientId }) signs the player in (if needed) and returns a one-time code
 * that the game server exchanges with Google (see server/src/accounts.ts, POST /api/auth/google).
 */
@CapacitorPlugin(name = "PlayGamesAuth")
public class PlayGamesAuthPlugin extends Plugin {

    @PluginMethod
    public void serverAuthCode(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId == null || clientId.isEmpty()) { call.reject("missing clientId"); return; }
        if (!MainActivity.playGamesConfigured(getContext())) { call.reject("Play Games is not configured"); return; }
        GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());
        client.isAuthenticated().addOnCompleteListener(auth -> {
            boolean signedIn = auth.isSuccessful() && auth.getResult().isAuthenticated();
            if (signedIn) requestCode(client, clientId, call);
            else client.signIn().addOnCompleteListener(s -> {
                if (s.isSuccessful() && s.getResult().isAuthenticated()) requestCode(client, clientId, call);
                else call.reject("sign-in cancelled or failed");
            });
        });
    }

    private void requestCode(GamesSignInClient client, String clientId, PluginCall call) {
        client.requestServerSideAccess(clientId, false).addOnCompleteListener(t -> {
            if (t.isSuccessful() && t.getResult() != null) {
                JSObject out = new JSObject();
                out.put("code", t.getResult());
                call.resolve(out);
            } else {
                call.reject("no server auth code", t.getException());
            }
        });
    }
}
