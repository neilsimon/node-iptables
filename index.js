var spawn = require('child_process').spawn;
var lazy = require('lazy');

exports.allow = function (rule) {
    rule.target = 'ACCEPT';
    if (!rule.action) rule.action = '-A';
    newRule(rule);
}

exports.drop = function (rule) {
    rule.target = 'DROP';
    if (!rule.action) rule.action = '-A';
    newRule(rule);
}

exports.reject = function (rule) {
    rule.target = 'REJECT';
    if (!rule.action) rule.action = '-A';
    newRule(rule);
}

exports.list = function(chain, zeroCounters, cb) {
    if (typeof cb == 'undefined' && typeof zeroCounters == 'function') {
        cb = zeroCounters;
        zeroCounters = false;
    } else if (typeof zeroCounters == 'undefined') {
        zeroCounters = false;
    }

    var rule = {
        list : true,
        chain : chain,
        action : '-L',
        zeroCounters : zeroCounters;
        sudo : true
    };

    lazy(iptables(rule).stdout)
        .lines
        .map(String)
        .skip(2)
        .map(function (line) {
            // packets, bytes, target, pro, opt, in, out, src, dst, opts
            var fields = line.trim().split(/\s+/);
            var ret = {
                parsed : {
                    packets : fields[0],
                    bytes : fields[1],
                    target : fields[2],
                    protocol : fields[3],
                    opt : fields[4],
                    in : fields[5],
                    out : fields[6],
                    src : fields[7],
                    dst : fields[8],
                    rest : fields[9]
                },
                raw : line.trim()
            };
            for (var i=10; i < fields.length; i++)
            {
                ret.parsed.rest += ' ' + fields[i];
            }
            return ret;
        })
        .join(function (rules) {
            cb(rules);
        })
}

exports.newRule = newRule;
exports.deleteRule = deleteRule;

function iptables (rule) {
    var args = iptablesArgs(rule);

    var cmd = 'iptables';
    if (rule.sudo) {
        cmd = 'sudo';
        args = ['iptables'].concat(args);
    }

    var proc = spawn(cmd, args);
    proc.stderr.on('data', function (buf) {
        console.error(buf.toString());
    });
    return proc;
}

function iptablesArgs (rule) {
    var args = [];

    if (!rule.chain) rule.chain = 'INPUT';

    if (rule.chain) args = args.concat([rule.action, rule.chain]);
    if (rule.protocol) args = args.concat(["-p", rule.protocol]);
    if (rule.src) args = args.concat(["--src", rule.src]);
    if (rule.dst) args = args.concat(["--dst", rule.dst]);
    if (rule.sport) args = args.concat(["--sport", rule.sport]);
    if (rule.dport) args = args.concat(["--dport", rule.dport]);
    if (rule.in) args = args.concat(["-i", rule.in]);
    if (rule.out) args = args.concat(["-o", rule.out]);
    if (rule.target) args = args.concat(["-j", rule.target]);
    if (rule.list) args = args.concat(["-n", "-v", "-x"]);
    if (rule.list && rule.zeroCounters) args = args.concat("-Z");
    if (rule.user) args = args.concat(["-m", "owner", "--uid-owner", rule.user]);
    if (rule.quota) args = args.concat(["-m quota --quota", rule.quota]);
    if (rule.tcpFlags) args = args.concat(['-m', 'tcp', '--tcp-flags', rule.tcpFlags.mask, rule.tcpFlags.comp]);
    if (rule.state) args = args.concat(["-m", "state", "--state", rule.state]);
    if (rule.dnat) args = args.concat(['--to-destination', rule.dnat]);
    if (rule.params && Array.isArray(rule.params)) args = args.concat(rule.params);

    return args;
}

function newRule (rule) {
    iptables(rule);
}

function deleteRule (rule) {
    rule.action = '-D';
    iptables(rule);
}

