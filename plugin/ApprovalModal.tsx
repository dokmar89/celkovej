import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button } from '@/components/ui/dialog';

interface ApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApprove: () => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, onApprove }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Approve Request</DialogTitle>
                </DialogHeader>
                <p>Are you sure you want to approve this request?</p>
                <DialogFooter>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button onClick={() => { onApprove(); onClose(); }}>Approve</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ApprovalModal;
