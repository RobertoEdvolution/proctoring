<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Observer for the quizaccess_proctoring plugin.
 *
 * @package    quizaccess_proctoring
 * @copyright  2024 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace quizaccess_proctoring;

/**
 * quizaccess_proctoring_observer class.
 *
 * Handles quiz events. On submission, triggers the Cloud Run analysis service.
 *
 * @package    quizaccess_proctoring
 * @copyright  2020 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class quizaccess_proctoring_observer {

    /**
     * Handle the event when a quiz attempt is started (regular or preview).
     *
     * @param \core\event\base $event The event object.
     * @return void
     */
    public static function handle_quiz_attempt_started(\core\event\base $event) {
        // No action needed on attempt start for Cloud Run.
    }

    /**
     * Handle the event when a quiz attempt is submitted (student, admin, or teacher).
     *
     * This fires for ALL users: students submitting their attempt and
     * admins/teachers submitting a preview attempt.
     *
     * @param \mod_quiz\event\attempt_submitted $event The event object.
     * @return void
     */
    public static function handle_quiz_attempt_submitted(\mod_quiz\event\attempt_submitted $event) {
        $eventdata = $event->get_data();
        self::trigger_analysis(
            (int) $eventdata['relateduserid'],
            (int) $eventdata['contextinstanceid'],
            (int) $eventdata['courseid'],
            (int) $eventdata['objectid']
        );
    }

    /**
     * Handle the event when a quiz attempt is reviewed (teacher grades a student attempt).
     *
     * Triggers Cloud Run analysis as a fallback in case the submission event
     * did not fire (e.g. auto-graded attempts).
     *
     * @param \mod_quiz\event\attempt_reviewed $event The event object.
     * @return void
     */
    public static function handle_quiz_attempt_reviewed(\mod_quiz\event\attempt_reviewed $event) {
        $eventdata = $event->get_data();
        // Use relateduserid (the student), not userid (the teacher who reviewed).
        self::trigger_analysis(
            (int) $eventdata['relateduserid'],
            (int) $eventdata['contextinstanceid'],
            (int) $eventdata['courseid'],
            (int) $eventdata['objectid']
        );
    }

    /**
     * Write a log entry to a dedicated proctoring log file.
     *
     * @param string $message The message to log.
     * @return void
     */
    private static function log($message) {
        global $CFG;
        $logfile = $CFG->dataroot . '/proctoring_analysis.log';
        $timestamp = date('Y-m-d H:i:s');
        file_put_contents($logfile, "[{$timestamp}] {$message}" . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

    /**
     * Trigger the Cloud Run analysis service.
     *
     * Sends an HTTP POST to the configured Cloud Run URL with the quiz attempt data.
     * The userid and quizid (cmid) match the values stored in quizaccess_proctoring_logs.
     *
     * @param int $userid   The student's user ID (matches quizaccess_proctoring_logs.userid).
     * @param int $quizid   The course module ID (matches quizaccess_proctoring_logs.quizid).
     * @param int $courseid The course ID.
     * @param int $attemptid The quiz attempt ID.
     * @return void
     */
    private static function trigger_analysis(int $userid, int $quizid, int $courseid, int $attemptid) {
        $cloudrunurl = get_config('quizaccess_proctoring', 'cloudrun_url');
        $cloudruntoken = get_config('quizaccess_proctoring', 'cloudrun_token');

        self::log("Observer triggered: userid={$userid} quizid={$quizid} attemptid={$attemptid}");

        if (empty($cloudrunurl) || empty($cloudruntoken)) {
            self::log("Skipped - URL=[{$cloudrunurl}] Token=" . (empty($cloudruntoken) ? 'EMPTY' : 'SET'));
            return;
        }

        $payload = json_encode([
            'token' => $cloudruntoken,
            'userid' => $userid,
            'quizid' => $quizid,
            'courseid' => $courseid,
            'attemptid' => $attemptid,
            'moodle_base_url' => (string) (new \moodle_url('/'))->out(false),
        ]);

        self::log("Sending to Cloud Run: {$payload}");

        $curl = new \curl();
        $curl->setopt([
            'CURLOPT_CONNECTTIMEOUT' => 5,
            'CURLOPT_TIMEOUT' => 10,
        ]);

        $response = $curl->post($cloudrunurl, $payload, [
            'CURLOPT_HTTPHEADER' => [
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ]);

        $info = $curl->get_info();
        $httpcode = $info['http_code'] ?? 0;
        $curlerror = $curl->get_errno() ? $curl->error : '';

        if ($curlerror) {
            self::log("CURL ERROR: {$curlerror} for attemptid={$attemptid}");
        } else if ($httpcode < 200 || $httpcode >= 300) {
            self::log("HTTP {$httpcode} for attemptid={$attemptid}. Response: " . substr($response, 0, 500));
        } else {
            self::log("SUCCESS HTTP {$httpcode} for attemptid={$attemptid}. Response: " . substr($response, 0, 500));
        }
    }
}