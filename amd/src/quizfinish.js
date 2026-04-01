/**
 * Quiz finish module — fires the Cloud Run analysis web service when the
 * student submits the quiz, without blocking or delaying the normal Moodle
 * submission flow.  Uses navigator.sendBeacon (with fetch+keepalive as
 * fallback) so the request survives page navigation.
 *
 * @module     quizaccess_proctoring/quizfinish
 * @copyright  2024 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {

    /** @type {boolean} Guard so we only fire once per page load. */
    var fired = false;

    /**
     * Send the Cloud Run trigger via sendBeacon/fetch-keepalive.
     * This survives page navigation so the form submit is never delayed.
     *
     * @param {Object} props  courseid, quizid, status (attemptid)
     */
    var fireCloudRun = function(props) {
        if (fired) {
            return;
        }
        fired = true;

        // Build the Moodle AJAX web-service URL.
        var wsUrl = M.cfg.wwwroot + '/lib/ajax/service.php?sesskey='
            + M.cfg.sesskey + '&info=quizaccess_proctoring_trigger_analysis';

        var payload = JSON.stringify([{
            index: 0,
            methodname: 'quizaccess_proctoring_trigger_analysis',
            args: {
                courseid: props.courseid,
                quizid:   props.quizid,
                attemptid: props.status,
            }
        }]);

        // sendBeacon is fire-and-forget and survives page unload.
        if (navigator.sendBeacon) {
            navigator.sendBeacon(wsUrl, new Blob([payload], {type: 'application/json'}));
        } else {
            // Fallback: fetch with keepalive also survives navigation.
            fetch(wsUrl, {
                method: 'POST',
                body: payload,
                keepalive: true,
                headers: {'Content-Type': 'application/json'}
            }).catch(function() { /* intentionally silent */ });
        }
    };

    return {
        /**
         * Initialise the quiz finish trigger.
         *
         * @param {Object} props Record passed from rule.php (courseid, quizid, status).
         */
        init: function(props) {
            var form = document.getElementById('frm-finishattempt');
            if (!form) {
                return;
            }

            // Hook into the form's submit() method.  Moodle's confirmation
            // module calls form.submit() after the student confirms — we
            // fire the Cloud Run beacon and then let the real submit proceed.
            var nativeSubmit = HTMLFormElement.prototype.submit;
            form.submit = function() {
                fireCloudRun(props);
                nativeSubmit.call(form);
            };

            // Also catch submit events (e.g. Enter key).
            form.addEventListener('submit', function() {
                fireCloudRun(props);
                // Don't preventDefault — let the form submit normally.
            });
        }
    };
});