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
 * Handles quiz events like attempt start and submission.
 * On submission, triggers the Cloud Run analysis service.
 *
 * @package    quizaccess_proctoring
 * @copyright  2020 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class quizaccess_proctoring_observer {
    /**
     * Handle the event when a quiz attempt is started.
     *
     * @param \mod_quiz\event\attempt_started $event The event object.
     * @return void
     */
    public static function handle_quiz_attempt_started(\mod_quiz\event\attempt_started $event) {
        self::update_event_data($event);
    }

    /**
     * Handle the event when a quiz attempt is submitted.
     *
     * Triggers the Cloud Run proctoring analysis service if configured.
     *
     * @param \mod_quiz\event\attempt_submitted $event The event object.
     * @return void
     */
    public static function handle_quiz_attempt_submitted(\mod_quiz\event\attempt_submitted $event) {
        self::update_event_data($event);
        self::trigger_analysis($event);
    }

    /**
     * Take a screenshot during the proctoring process.
     *
     * @param \quizaccess_proctoring\take_screensho $event The event object.
     * @return void
     */
    public static function take_screenshot(\quizaccess_proctoring\take_screensho $event) {
        global $DB;
        $record = $event->get_record_snapshot('quizaccess_proctoring_logs', $event->objectid);
        $DB->update_record('quizaccess_proctoring_logs', $record);
    }

    /**
     * Update logs of proctoring events.
     *
     * @param \mod_quiz\event\attempt_started|\mod_quiz\event\attempt_submitted $event The event object.
     * @return void
     */
    private static function update_event_data($event) {
        global $DB;
        $DB->update_record('quizaccess_proctoring_logs', $event);
    }

    /**
     * Trigger the Cloud Run analysis service after quiz submission.
     *
     * Sends an asynchronous HTTP POST to the configured Cloud Run URL
     * with the attempt data so images and audio can be analyzed.
     *
     * @param \mod_quiz\event\attempt_submitted $event The event object.
     * @return void
     */
    private static function trigger_analysis($event) {
        $cloudrunurl = get_config('quizaccess_proctoring', 'cloudrun_url');
        $cloudruntoken = get_config('quizaccess_proctoring', 'cloudrun_token');

        $logprefix = 'quizaccess_proctoring [analysis]: ';

        if (empty($cloudrunurl) || empty($cloudruntoken)) {
            mtrace($logprefix . 'Skipped - cloudrun_url or cloudrun_token not configured.');
            error_log($logprefix . 'Skipped - cloudrun_url or cloudrun_token not configured.');
            return;
        }

        $eventdata = $event->get_data();
        $userid = $eventdata['userid'];
        $quizid = $eventdata['contextinstanceid'];
        $courseid = $eventdata['courseid'];
        $attemptid = $eventdata['objectid'];

        error_log($logprefix . "Triggering analysis for userid={$userid} quizid={$quizid} attemptid={$attemptid} url={$cloudrunurl}");

        $payload = json_encode([
            'token' => $cloudruntoken,
            'userid' => (int) $userid,
            'quizid' => (int) $quizid,
            'courseid' => (int) $courseid,
            'attemptid' => (int) $attemptid,
            'moodle_base_url' => (string) (new \moodle_url('/'))->out(false),
        ]);

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
            error_log($logprefix . "CURL ERROR: {$curlerror} for attemptid={$attemptid}");
        } else if ($httpcode < 200 || $httpcode >= 300) {
            error_log($logprefix . "HTTP {$httpcode} for attemptid={$attemptid}. Response: " . substr($response, 0, 500));
        } else {
            error_log($logprefix . "SUCCESS HTTP {$httpcode} for attemptid={$attemptid}. Response: " . substr($response, 0, 500));
        }
    }
}