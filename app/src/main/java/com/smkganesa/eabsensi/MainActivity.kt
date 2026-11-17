package com.smkganesa.eabsensi

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.net.Uri
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebResourceRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        filePathCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        filePathCallback = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            // Kamera tidak diizinkan oleh pengguna.
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    // Android 9 ke bawah: pengguna memilih lokasi simpan lewat dialog sistem.
    private var pendingSaveBytes: ByteArray? = null

    private val createDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument(XLSX_MIME)
    ) { uri ->
        val bytes = pendingSaveBytes
        pendingSaveBytes = null
        if (uri == null || bytes == null) {
            showToast("Penyimpanan file dibatalkan.")
        } else {
            try {
                val out = contentResolver.openOutputStream(uri)
                    ?: throw IllegalStateException("Stream kosong")
                out.use { it.write(bytes) }
                showToast("File berhasil disimpan.")
            } catch (e: Exception) {
                showToast("Gagal menyimpan file.")
            }
        }
    }

    // Jembatan dari JavaScript (WebView tidak bisa mengunduh file buatan sendiri).
    inner class AndroidBridge {
        @JavascriptInterface
        fun saveFile(filename: String, mime: String, base64: String) {
            val bytes = try {
                Base64.decode(base64, Base64.DEFAULT)
            } catch (e: IllegalArgumentException) {
                null
            }
            runOnUiThread {
                if (bytes == null) showToast("Gagal membuat file.")
                else saveToDownloads(filename, mime, bytes)
            }
        }
    }

    private fun saveToDownloads(filename: String, mime: String, bytes: ByteArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Uri kosong")
                val out = contentResolver.openOutputStream(uri)
                    ?: throw IllegalStateException("Stream kosong")
                out.use { it.write(bytes) }
                values.clear()
                values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                contentResolver.update(uri, values, null, null)
                showToast("Tersimpan di folder Download: $filename")
            } catch (e: Exception) {
                showToast("Gagal menyimpan file.")
            }
        } else {
            pendingSaveBytes = bytes
            createDocumentLauncher.launch(filename)
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        createNotificationChannel()

        webView = WebView(this)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true

        webView.webViewClient = object : WebViewClient() {
            // Tautan http/https (misalnya dari pengumuman) dibuka di browser, bukan di dalam aplikasi.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val scheme = request.url.scheme ?: return false
                if (scheme == "http" || scheme == "https") {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    } catch (e: Exception) {
                        showToast("Tidak ada aplikasi untuk membuka tautan.")
                    }
                    return true
                }
                return false
            }
        }
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (request.resources.contains(
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE
                        )
                    ) {
                        if (
                            ContextCompat.checkSelfPermission(
                                this@MainActivity,
                                Manifest.permission.CAMERA
                            ) == PackageManager.PERMISSION_GRANTED
                        ) {
                            request.grant(
                                arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                            )
                        } else {
                            request.deny()
                            requestCameraPermission()
                        }
                    } else {
                        request.deny()
                    }
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                fileChooserLauncher.launch("image/*")
                return true
            }
        }

        setContentView(webView)

        requestCameraPermission()
        requestNotificationPermission()
        subscribeToAnnouncements()

        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun requestCameraPermission() {
        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun requestNotificationPermission() {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(
                Manifest.permission.POST_NOTIFICATIONS
            )
        }
    }

    private fun subscribeToAnnouncements() {
        FirebaseMessaging.getInstance()
            .subscribeToTopic("pengumuman_itc")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "pengumuman_itc",
                "Pengumuman ITC",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifikasi pengumuman E-Absensi ITC"
            }

            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private companion object {
        const val XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
