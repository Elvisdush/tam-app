import 'package:flutter/material.dart';

/// Parity with [tam/components/navigation/NextManeuverBar.tsx] (simplified).
class NextManeuverBar extends StatelessWidget {
  const NextManeuverBar({
    super.key,
    required this.instruction,
    required this.distanceLabel,
    required this.durationLabel,
    required this.onClose,
  });

  final String instruction;
  final String distanceLabel;
  final String durationLabel;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            const Icon(Icons.navigation, size: 28),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(instruction, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('$distanceLabel · $durationLabel', style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
            IconButton(onPressed: onClose, icon: const Icon(Icons.close)),
          ],
        ),
      ),
    );
  }
}
