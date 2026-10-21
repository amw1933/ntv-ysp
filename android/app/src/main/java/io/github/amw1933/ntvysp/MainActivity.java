package io.github.amw1933.ntvysp;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import tv.danmaku.ijk.media.player.IjkMediaPlayer;

public final class MainActivity extends Activity {
    private static final String PREFS = "gateway";
    private static final String KEY_URL = "url";
    private static final String KEY_CHANNEL = "channel";
    private static final String KEY_QUALITY = "quality";
    private static final String[] QUALITY_VALUES = {"1080", "4k", "720", "auto"};
    private static final String[] QUALITY_LABELS = {"1080P", "4K 优先", "720P", "自动"};

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final List<Channel> channels = new ArrayList<>();

    private SharedPreferences preferences;
    private String gatewayUrl;
    private String quality = "1080";
    private Channel currentChannel;
    private LinearLayout sidebar;
    private ListView channelList;
    private TextView statusView;
    private TextView nowPlayingView;
    private TextView gatewayView;
    private Spinner qualitySpinner;
    private FrameLayout videoFrame;
    private SurfaceView videoSurface;
    private SurfaceHolder surfaceHolder;
    private IjkMediaPlayer player;
    private boolean muted;
    private boolean userSelectedQuality;
    private float videoAspect = 16f / 9f;
    private final Runnable collapseSidebar = () -> {
        if (sidebar != null) {
            sidebar.setVisibility(View.GONE);
        }
    };

    private static final class Channel {
        final String slug;
        final String name;
        final String group;
        final boolean catchup;

        Channel(String slug, String name, String group, boolean catchup) {
            this.slug = slug;
            this.name = name;
            this.group = group;
            this.catchup = catchup;
        }

        @Override
        public String toString() {
            return "央视".equals(group) ? name : "卫视 · " + name;
        }
    }

    private static final class Program {
        final long start;
        final long stop;
        final String title;

        Program(long start, long stop, String title) {
            this.start = start;
            this.stop = stop;
            this.title = title;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        gatewayUrl = normalizeGateway(
                preferences.getString(KEY_URL, BuildConfig.DEFAULT_GATEWAY_URL));
        quality = preferences.getString(KEY_QUALITY, "1080");
        muted = preferences.getBoolean("muted", false);
        setContentView(buildInterface());
        loadChannels();
    }

    private View buildInterface() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.HORIZONTAL);
        root.setBackgroundColor(Color.BLACK);

        sidebar = new LinearLayout(this);
        sidebar.setOrientation(LinearLayout.VERTICAL);
        sidebar.setBackgroundColor(Color.rgb(14, 22, 33));
        root.addView(sidebar, new LinearLayout.LayoutParams(dp(270),
                LinearLayout.LayoutParams.MATCH_PARENT));

        TextView title = new TextView(this);
        title.setText("nTv YSP");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setPadding(dp(16), dp(14), dp(16), dp(12));
        sidebar.addView(title, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(62)));

        channelList = new ListView(this);
        channelList.setBackgroundColor(Color.rgb(14, 22, 33));
        channelList.setDividerHeight(1);
        channelList.setChoiceMode(ListView.CHOICE_MODE_SINGLE);
        channelList.setFocusableInTouchMode(true);
        channelList.setOnItemClickListener((parent, view, position, id) -> {
            playLive(channels.get(position));
        });
        sidebar.addView(channelList, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        gatewayView = new TextView(this);
        gatewayView.setText(gatewayUrl);
        gatewayView.setTextColor(Color.rgb(139, 155, 176));
        gatewayView.setTextSize(11);
        gatewayView.setPadding(dp(14), dp(8), dp(14), dp(10));
        sidebar.addView(gatewayView);

        videoFrame = new FrameLayout(this);
        videoFrame.setBackgroundColor(Color.BLACK);
        root.addView(videoFrame, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.MATCH_PARENT, 1f));

        videoSurface = new SurfaceView(this);
        surfaceHolder = videoSurface.getHolder();
        surfaceHolder.addCallback(new SurfaceHolder.Callback() {
            @Override
            public void surfaceCreated(SurfaceHolder holder) {
                if (player != null) {
                    player.setDisplay(holder);
                }
            }

            @Override
            public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            }

            @Override
            public void surfaceDestroyed(SurfaceHolder holder) {
                if (player != null) {
                    player.setDisplay(null);
                }
            }
        });
        videoFrame.addView(videoSurface, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        videoFrame.addOnLayoutChangeListener((view, left, top, right, bottom,
                                              oldLeft, oldTop, oldRight, oldBottom) ->
                updateVideoSize());

        statusView = new TextView(this);
        statusView.setText("正在读取频道");
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(14);
        statusView.setPadding(dp(11), dp(7), dp(11), dp(7));
        statusView.setBackgroundColor(0xB3000000);
        FrameLayout.LayoutParams statusParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP | Gravity.START);
        statusParams.setMargins(dp(14), dp(14), dp(14), 0);
        videoFrame.addView(statusView, statusParams);

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.setPadding(dp(12), dp(8), dp(12), dp(8));
        controls.setBackgroundColor(0xD90C1118);

        nowPlayingView = new TextView(this);
        nowPlayingView.setText("请选择频道");
        nowPlayingView.setTextColor(Color.WHITE);
        nowPlayingView.setTextSize(15);
        nowPlayingView.setSingleLine(true);
        controls.addView(nowPlayingView, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        qualitySpinner = new Spinner(this);
        ArrayAdapter<String> qualityAdapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                QUALITY_LABELS);
        qualitySpinner.setAdapter(qualityAdapter);
        controls.addView(qualitySpinner, new LinearLayout.LayoutParams(
                dp(118), LinearLayout.LayoutParams.WRAP_CONTENT));

        Button liveButton = button("直播");
        controls.addView(liveButton);
        liveButton.setOnClickListener(view -> {
            if (currentChannel != null) {
                playLive(currentChannel);
            }
        });

        Button guideButton = button("节目单");
        controls.addView(guideButton);
        guideButton.setOnClickListener(view -> loadGuide());

        Button soundButton = button(muted ? "开声音" : "静音");
        controls.addView(soundButton);
        soundButton.setOnClickListener(view -> {
            muted = !muted;
            preferences.edit().putBoolean("muted", muted).apply();
            soundButton.setText(muted ? "开声音" : "静音");
            applyVolume();
        });

        FrameLayout.LayoutParams controlsParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM);
        videoFrame.addView(controls, controlsParams);

        qualitySpinner.setSelection(qualityIndex(quality));
        qualitySpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (!userSelectedQuality) {
                    userSelectedQuality = true;
                    return;
                }
                quality = QUALITY_VALUES[position];
                preferences.edit().putString(KEY_QUALITY, quality).apply();
                if (currentChannel != null) {
                    playLive(currentChannel);
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });
        return root;
    }

    private Button button(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(14);
        button.setFocusable(true);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(42));
        params.setMargins(dp(7), 0, 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private void loadChannels() {
        setStatus("正在读取频道");
        executor.execute(() -> {
            try {
                String body = httpGet(gatewayUrl + "api/channels");
                JSONObject root = new JSONObject(body);
                JSONArray array = root.getJSONArray("channels");
                List<Channel> loaded = new ArrayList<>();
                for (int index = 0; index < array.length(); index += 1) {
                    JSONObject item = array.getJSONObject(index);
                    loaded.add(new Channel(
                            item.getString("slug"),
                            item.getString("name"),
                            item.optString("group", "其他"),
                            item.optBoolean("catchup", false)));
                }
                mainHandler.post(() -> applyChannels(loaded));
            } catch (Exception error) {
                mainHandler.post(() -> {
                    setStatus("网关连接失败：" + error.getMessage());
                    showGatewayDialog();
                });
            }
        });
    }

    private void applyChannels(List<Channel> loaded) {
        channels.clear();
        channels.addAll(loaded);
        ArrayAdapter<Channel> adapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_list_item_1,
                channels);
        channelList.setAdapter(adapter);
        gatewayView.setText(gatewayUrl);
        setStatus(channels.size() + " 路频道");
        if (channels.isEmpty()) {
            return;
        }
        String saved = preferences.getString(KEY_CHANNEL, "cctv1");
        int selected = 0;
        for (int index = 0; index < channels.size(); index += 1) {
            if (saved.equals(channels.get(index).slug)) {
                selected = index;
                break;
            }
        }
        channelList.setItemChecked(selected, true);
        channelList.setSelection(selected);
        channelList.requestFocus();
        playLive(channels.get(selected));
    }

    private void playLive(Channel channel) {
        currentChannel = channel;
        preferences.edit().putString(KEY_CHANNEL, channel.slug).apply();
        String url = gatewayUrl + channel.slug + ".m3u8?quality=" + quality;
        playUrl(channel, url, "直播");
    }

    private void playCatchup(Program program) {
        Channel channel = currentChannel;
        if (channel == null) {
            return;
        }
        long now = System.currentTimeMillis() / 1000L;
        if (now < program.stop) {
            playLive(channel);
            return;
        }
        if (!channel.catchup) {
            Toast.makeText(this, "该频道仅支持直播", Toast.LENGTH_SHORT).show();
            return;
        }
        String range = compactTime(program.start) + "-" + compactTime(program.stop);
        String url = gatewayUrl + channel.slug + ".m3u8?playseek=" + range
                + "&quality=" + quality;
        playUrl(channel, url, program.title);
    }

    private void playUrl(Channel channel, String url, String mode) {
        releasePlayer();
        setStatus("正在连接 " + channel.name);
        nowPlayingView.setText(channel.name + " · " + mode);
        scheduleSidebarCollapse();
        IjkMediaPlayer next = new IjkMediaPlayer();
        player = next;
        next.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "mediacodec", 1L);
        next.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "mediacodec-auto-rotate", 1L);
        next.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "framedrop", 1L);
        next.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "start-on-prepared", 1L);
        next.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "packet-buffering", 1L);
        next.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "max-buffer-size", 15L * 1024L * 1024L);
        next.setOnPreparedListener(mediaPlayer -> {
            if (player != mediaPlayer) {
                return;
            }
            applyVolume();
            mediaPlayer.start();
            setStatus(channel.name + " · 播放中");
        });
        next.setOnInfoListener((mediaPlayer, what, extra) -> {
            if (what == IjkMediaPlayer.MEDIA_INFO_BUFFERING_START) {
                setStatus(channel.name + " · 缓冲中");
            } else if (what == IjkMediaPlayer.MEDIA_INFO_BUFFERING_END) {
                setStatus(channel.name + " · 播放中");
            }
            return false;
        });
        next.setOnVideoSizeChangedListener((mediaPlayer, width, height, sarNum, sarDen) -> {
            if (width > 0 && height > 0) {
                float pixelAspect = sarNum > 0 && sarDen > 0
                        ? (float) sarNum / (float) sarDen
                        : 1f;
                videoAspect = ((float) width / (float) height) * pixelAspect;
                mainHandler.post(this::updateVideoSize);
            }
        });
        next.setOnErrorListener((mediaPlayer, what, extra) -> {
            if (player == mediaPlayer) {
                setStatus(channel.name + " · 播放失败 " + what + "/" + extra);
            }
            return true;
        });
        next.setDisplay(surfaceHolder);
        try {
            next.setDataSource(url);
            next.prepareAsync();
        } catch (Exception error) {
            setStatus(channel.name + " · " + error.getMessage());
        }
    }

    private void applyVolume() {
        if (player != null) {
            float volume = muted ? 0f : 1f;
            player.setVolume(volume, volume);
        }
    }

    private void updateVideoSize() {
        if (videoFrame == null || videoSurface == null) {
            return;
        }
        int maxWidth = videoFrame.getWidth();
        int maxHeight = videoFrame.getHeight();
        if (maxWidth <= 0 || maxHeight <= 0) {
            return;
        }
        float frameAspect = (float) maxWidth / (float) maxHeight;
        int width;
        int height;
        if (frameAspect > videoAspect) {
            height = maxHeight;
            width = Math.round(height * videoAspect);
        } else {
            width = maxWidth;
            height = Math.round(width / videoAspect);
        }
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                width,
                height,
                Gravity.CENTER);
        videoSurface.setLayoutParams(params);
    }

    private void scheduleSidebarCollapse() {
        mainHandler.removeCallbacks(collapseSidebar);
        mainHandler.postDelayed(collapseSidebar, 4000L);
    }

    private void showSidebar() {
        mainHandler.removeCallbacks(collapseSidebar);
        if (sidebar != null) {
            sidebar.setVisibility(View.VISIBLE);
        }
        if (channelList != null) {
            channelList.post(() -> {
                channelList.requestFocusFromTouch();
                channelList.requestFocus();
            });
        }
    }

    private void loadGuide() {
        final Channel channel = currentChannel;
        if (channel == null) {
            return;
        }
        if (!channel.catchup) {
            Toast.makeText(this, "该频道仅支持直播", Toast.LENGTH_SHORT).show();
            return;
        }
        setStatus("正在读取节目单");
        executor.execute(() -> {
            try {
                String date = new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA)
                        .format(new Date());
                String body = httpGet(gatewayUrl + "api/epg/" + channel.slug
                        + "?date=" + date);
                JSONObject root = new JSONObject(body);
                JSONArray array = root.getJSONArray("programs");
                long now = System.currentTimeMillis() / 1000L;
                List<Program> programs = new ArrayList<>();
                List<String> labels = new ArrayList<>();
                SimpleDateFormat time = new SimpleDateFormat("HH:mm", Locale.CHINA);
                time.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));
                for (int index = 0; index < array.length(); index += 1) {
                    JSONObject item = array.getJSONObject(index);
                    long start = item.getLong("start");
                    long stop = item.getLong("stop");
                    String title = item.getString("title");
                    if (start > now) {
                        continue;
                    }
                    programs.add(new Program(start, stop, title));
                    labels.add(time.format(new Date(start * 1000L)) + " - "
                            + time.format(new Date(stop * 1000L)) + "  " + title
                            + (now < stop ? "  [直播中]" : ""));
                }
                mainHandler.post(() -> {
                    setStatus(channel.name + " · 节目单");
                    if (programs.isEmpty()) {
                        Toast.makeText(this, "没有可显示的节目", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    new AlertDialog.Builder(this)
                            .setTitle(channel.name)
                            .setItems(labels.toArray(new String[0]), (dialog, which) ->
                                    playCatchup(programs.get(which)))
                            .setNegativeButton("关闭", null)
                            .show();
                });
            } catch (Exception error) {
                mainHandler.post(() -> setStatus("节目单失败：" + error.getMessage()));
            }
        });
    }

    private void showGatewayDialog() {
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(gatewayUrl);
        input.setSelectAllOnFocus(true);
        new AlertDialog.Builder(this)
                .setTitle("网关地址")
                .setMessage("例如 http://10.10.10.108:8768")
                .setView(input)
                .setPositiveButton("连接", (dialog, which) -> {
                    gatewayUrl = normalizeGateway(input.getText().toString());
                    preferences.edit().putString(KEY_URL, gatewayUrl).apply();
                    gatewayView.setText(gatewayUrl);
                    loadChannels();
                })
                .setNegativeButton("取消", null)
                .show();
    }

    private static String normalizeGateway(String value) {
        String url = value == null ? "" : value.trim();
        if (url.isEmpty()) {
            url = BuildConfig.DEFAULT_GATEWAY_URL;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url + "/";
    }

    private static String compactTime(long seconds) {
        SimpleDateFormat format = new SimpleDateFormat("yyyyMMddHHmmss", Locale.CHINA);
        format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));
        return format.format(new Date(seconds * 1000L));
    }

    private static int qualityIndex(String value) {
        for (int index = 0; index < QUALITY_VALUES.length; index += 1) {
            if (QUALITY_VALUES[index].equals(value)) {
                return index;
            }
        }
        return 0;
    }

    private void setStatus(String text) {
        statusView.setText(text);
    }

    private String httpGet(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("User-Agent", "nTvYSPTV/0.1");
        try {
            int status = connection.getResponseCode();
            InputStream input = status >= 400
                    ? connection.getErrorStream() : connection.getInputStream();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (input != null) {
                try (BufferedInputStream buffered = new BufferedInputStream(input)) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = buffered.read(buffer)) >= 0) {
                        output.write(buffer, 0, count);
                    }
                }
            }
            String body = new String(output.toByteArray(), StandardCharsets.UTF_8);
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("HTTP " + status + " " + body);
            }
            return body;
        } finally {
            connection.disconnect();
        }
    }

    private void releasePlayer() {
        IjkMediaPlayer old = player;
        player = null;
        if (old != null) {
            try {
                old.stop();
            } catch (Exception ignored) {
            }
            old.release();
        }
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()));
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showGatewayDialog();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT
                && sidebar != null
                && sidebar.getVisibility() != View.VISIBLE) {
            showSidebar();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_BACK
                && sidebar != null
                && sidebar.getVisibility() == View.VISIBLE) {
            scheduleSidebarCollapse();
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(collapseSidebar);
        releasePlayer();
        executor.shutdownNow();
        super.onDestroy();
    }
}
