import type { ApplicationStatus } from '../types'

const styles: Record<ApplicationStatus, string> = {
  Pending: 'bg-[#edf3fc] text-[#48729d]',
  Interviewing: 'bg-[#fff2db] text-[#9a721f]',
  Rejected: 'bg-[#faeeee] text-[#aa6868]',
  Accepted: 'bg-[#e6f4e6] text-[#367a4a]',
}

function labelFor(status: ApplicationStatus, interviewBooked: boolean): string {
  if (status === 'Interviewing') {
    return interviewBooked ? 'Interview booked' : 'Invited'
  }
  return status
}

function ApplicationStatusBadge({
  status,
  interviewBooked = false,
}: {
  status: ApplicationStatus
  interviewBooked?: boolean
}) {
  return (
    <span
      className={`whitespace-nowrap rounded-[20px] px-[11px] py-[7px] text-[11px] font-extrabold ${styles[status]}`}
    >
      {labelFor(status, interviewBooked)}
    </span>
  )
}

export default ApplicationStatusBadge
